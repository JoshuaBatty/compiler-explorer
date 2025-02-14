import path from 'path';

import fsExtra from 'fs-extra';

import {CompilationResult, ExecutionOptionsWithEnv} from '../../types/compilation/compilation.interfaces.js';
import {LLVMIrBackendOptions} from '../../types/compilation/ir.interfaces.js';
import {PreliminaryCompilerInfo} from '../../types/compiler.interfaces.js';
import {ParseFiltersAndOutputOptions} from '../../types/features/filters.interfaces.js';
import {ResultLine} from '../../types/resultline/resultline.interfaces.js';
import {BaseCompiler} from '../base-compiler.js';
import {CompilationEnvironment} from '../compilation-env.js';

interface SymbolMap {
    paths: string[];
    map: {
        [key: string]: {
            path: number;
            range: {
                start: {line: number; col: number};
                end: {line: number; col: number};
            };
        };
    };
}

export class SwayCompiler extends BaseCompiler {
    static get key() {
        return 'sway-compiler';
    }

    constructor(info: PreliminaryCompilerInfo, env: CompilationEnvironment) {
        super(info, env);
        this.compiler.supportsIrView = true;
        this.compiler.irArg = ['build', '--ir', 'final'];
        this.compiler.supportsIntel = true;
    }

    override async checkOutputFileAndDoPostProcess(
        asmResult: CompilationResult,
        outputFilename: string,
        filters: ParseFiltersAndOutputOptions,
    ): Promise<[any, any[], any[]]> {
        // No need to check for files since we already have our ASM
        return [asmResult, [], []];
    }

    override async processAsm(result: any) {
        //console.log("processAsm got:", result);
        //console.log("processAsm asm type:", typeof result.asm);
        //console.log("processAsm asm is array:", Array.isArray(result.asm));

        // If compilation failed or we have no assembly, return as is
        if (result.code !== 0 || !result.asm || result.asm.length === 0) {
            result.asm = '<Compilation failed>';
            return result;
        }
        // The asm array should already be properly formatted from runCompiler
        return {
            asm: result.asm,
            labelDefinitions: {},
        };
    }

    override async generateIR(
        inputFilename: string,
        options: string[],
        irOptions: LLVMIrBackendOptions,
        produceCfg: boolean,
        filters: ParseFiltersAndOutputOptions,
    ) {
        // We can use runCompiler since it already handles all the project setup
        const result = await this.runCompiler(
            this.compiler.exe,
            ['build', '--ir', 'final'],
            inputFilename,
            this.getDefaultExecOptions(),
            filters,
        );

        // Just need to format the output as CE expects for IR view
        return {
            code: result.code,
            stdout: [],
            stderr: result.stderr,
            asm: result.irOutput?.asm || [],
            timedOut: result.timedOut,
            execTime: result.execTime,
            okToCache: true,
            inputFilename: result.inputFilename,
            dirPath: result.dirPath,
        };
    }

    override optionsForFilter(filters: ParseFiltersAndOutputOptions, outputFilename: string): string[] {
        // We need to return an array of command line options for the compiler
        const options = ['-o', outputFilename];
        // Only show asm output if we're not building an executable
        if (!filters.binary && !filters.binaryObject) {
            // Add any specific options needed to generate assembly output
            // options.push('--emit', 'asm');  // uncomment if sway has an option for this
        }
        // You might want to add additional options based on filters
        if (filters.intel) {
            // Add options for Intel syntax if supported
        }
        return options;
    }

    // Overriding runCompiler with the correct signature:
    override async runCompiler(
        compiler: string,
        options: string[],
        inputFilename: string,
        execOptions: ExecutionOptionsWithEnv,
        filters?: Partial<ParseFiltersAndOutputOptions>,
    ): Promise<CompilationResult> {
        // 1) Make a temp directory for a forc project
        const projectDir = await this.newTempDir();

        // 2) Create out/debug dir for forc to put its output there
        const outDebugDir = path.join(projectDir, 'out', 'debug');
        const symbolsPath = path.join(projectDir, 'out', 'debug', 'symbols.json');
        await fsExtra.mkdirp(outDebugDir);

        // 2) Write a Forc.toml
        const forcTomlPath = path.join(projectDir, 'Forc.toml');
        await fsExtra.writeFile(
            forcTomlPath,
            `[project]
entry = "main.sw"
license = "Apache-2.0"
name = "godbolt"

[dependencies]
std = { git = "https://github.com/FuelLabs/sway", tag = "v0.66.6" }
`,
        );

        // 3) Copy input file to src/main.sw
        const srcDir = path.join(projectDir, 'src');
        await fsExtra.mkdirp(srcDir);
        const mainSw = path.join(srcDir, 'main.sw');
        await fsExtra.copyFile(inputFilename, mainSw);

        // 4) Actually run `forc build` in that folder
        //    "compiler" is the path to your forc binary from .properties
        const buildResult = await this.exec(compiler, ['build', '-g', symbolsPath], {
            ...execOptions,
            customCwd: projectDir,
        });

        // 6) If build succeeded, parse the bytecode
        let asm: ResultLine[] = []; // Explicitly type this
        if (buildResult.code === 0) {
            const artifactPath = path.join(projectDir, 'out', 'debug', 'godbolt.bin');
            // If ASM view is requested (via Intel syntax toggle), use that
            if (filters?.intel) {
                const asmResult = await this.exec(compiler, ['build', '--asm', 'all'], {
                    ...execOptions,
                    customCwd: projectDir,
                });
                const lines = splitLines(asmResult.stdout);
                const startIndex = lines.findIndex(line => line.includes(';; ASM: Virtual abstract program'));
                const endIndex = lines.findIndex(line => line.includes('[1;32mFinished'));
                asm = lines
                    .slice(startIndex, endIndex)
                    .filter(line => line.trim() !== '')
                    .map(line => ({text: line}));
            } else {
                if (await fsExtra.pathExists(artifactPath)) {
                    const parseResult = await this.exec(compiler, ['parse-bytecode', artifactPath], {
                        ...execOptions,
                        customCwd: projectDir,
                    });
                    // After your build command when checking for the symbols file:
                    const symbolsPath = path.join(projectDir, 'out', 'debug', 'symbols.json');
                    console.log('Looking for symbols at:', symbolsPath);
                    asm = [];
                    if (await fsExtra.pathExists(symbolsPath)) {
                        console.log('Found symbols file!');
                        const symbolsContent = await fsExtra.readFile(symbolsPath, 'utf8');
                        const symbols: SymbolMap = JSON.parse(symbolsContent);
                        console.log('Loaded symbols:', symbols);

                        // When mapping each line:
                        // When mapping lines:
                        const lines = splitLines(parseResult.stdout)
                            .filter(line => line.trim() !== '')
                            .map(line => {
                                const match = line.match(/^\s*(\d+)\s+(\d+)\s+/);
                                if (match) {
                                    const opcodeIndex = match[1]; // The half-word index
                                    const symbolInfo = symbols.map[opcodeIndex];

                                    // Only map if it's from our source file (path 1) not the standard library
                                    if (symbolInfo && symbolInfo.path === 1) {
                                    // if (symbolInfo) {
                                        console.log(`Found source mapping for instruction ${opcodeIndex}:`, {
                                            sourceLine: symbolInfo.range.start.line,
                                            sourceCol: symbolInfo.range.start.col,
                                        });
                                        return {
                                            text: line,
                                            source: {
                                                file: symbols.paths[symbolInfo.path],
                                                line: symbolInfo.range.start.line,
                                                column: symbolInfo.range.start.col,
                                            },
                                        };
                                    }
                                }
                                return {text: line};
                            });

                        // Log final assembly
                        console.log(
                            'Final assembly lines:',
                            lines.map(l => ({
                                text: l.text,
                                source: l.source,
                            })),
                        );

                        asm.push(...lines);
                    }
                }
            }
        }

        // -------------------------------------------------------------
        // 9) [NEW CODE] If build succeeded, ALSO run `forc build --ir final`
        //    to gather IR output and store it in `result.irOutput`.
        // -------------------------------------------------------------
        let irLines: ResultLine[] = [];
        if (buildResult.code === 0) {
            const irResult = await this.exec(compiler, ['build', '--ir', 'final'], {
                ...execOptions,
                customCwd: projectDir,
            });
            // Find the main block (between "// IR: Final" and the first closing brace followed by debug info)
            const irOutput = irResult.stdout;
            const lastIrMarkerIndex = irOutput.lastIndexOf('// IR: Final');
            if (lastIrMarkerIndex !== -1) {
                // Get content after "// IR: Final"
                let relevantIr = irOutput.slice(lastIrMarkerIndex).split('\n').slice(1).join('\n');
                // Find the end of the main block (the closing brace of script/library/contract/predicate)
                const mainBlockMatch = relevantIr.match(/(script|library|contract|predicate)\s*{[^]*?^}/m);
                if (mainBlockMatch) {
                    relevantIr = mainBlockMatch[0];
                }
                irLines = relevantIr.split('\n').map(line => ({text: line}));
            } else {
                // Fallback to full output if marker not found
                irLines = splitLines(irResult.stdout).map(line => ({text: line}));
            }
        }

        // 7) Construct and return a CompilationResult
        const result: CompilationResult = {
            code: buildResult.code,
            timedOut: buildResult.timedOut ?? false,
            stdout: splitLines(buildResult.stdout).map(line => ({text: line})),
            stderr: splitLines(buildResult.stderr).map(line => ({text: line})),
            asm,
            inputFilename,
            execTime: buildResult.execTime,
            okToCache: true,
            dirPath: projectDir,

            irOutput: irLines.length > 0 ? {
                asm: irLines.map(line => ({
                    text: line.text,
                })),
            } : undefined,
        };

        // console.log("ASM output:", asm);
        //console.log("SWAY RESULT:", result);  // Let's see what the result looks like
        //console.log("SWAY FILTERS:", filters);  // And what filters we're getting

        return result;
    }
}

/**
 * Splits a multi-line string into an array of lines, omitting the trailing newline if present.
 */
function splitLines(str: string): string[] {
    return str.split(/\r?\n/);
}
