// Copyright (c) 2022, Compiler Explorer Authors
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright notice,
//       this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

import GoldenLayout, {ContentItem} from 'golden-layout';
type GLC = GoldenLayout.Container;

import _ from 'underscore';
import {LanguageKey} from '../types/languages.interfaces.js';
import {CompilerService} from './compiler-service.js';
import {
    AST_VIEW_COMPONENT_NAME,
    CFG_VIEW_COMPONENT_NAME,
    CLANGIR_VIEW_COMPONENT_NAME,
    COMPILER_COMPONENT_NAME,
    CONFORMANCE_VIEW_COMPONENT_NAME,
    DEVICE_VIEW_COMPONENT_NAME,
    DIFF_VIEW_COMPONENT_NAME,
    EDITOR_COMPONENT_NAME,
    EXECUTOR_COMPONENT_NAME,
    FLAGS_VIEW_COMPONENT_NAME,
    GCC_DUMP_VIEW_COMPONENT_NAME,
    GNAT_DEBUG_TREE_VIEW_COMPONENT_NAME,
    GNAT_DEBUG_VIEW_COMPONENT_NAME,
    HASKELL_CMM_VIEW_COMPONENT_NAME,
    HASKELL_CORE_VIEW_COMPONENT_NAME,
    HASKELL_STG_VIEW_COMPONENT_NAME,
    IR_VIEW_COMPONENT_NAME,
    LLVM_OPT_PIPELINE_VIEW_COMPONENT_NAME,
    OPT_PIPELINE_VIEW_COMPONENT_NAME,
    OPT_VIEW_COMPONENT_NAME,
    OUTPUT_COMPONENT_NAME,
    PP_VIEW_COMPONENT_NAME,
    RUST_HIR_VIEW_COMPONENT_NAME,
    RUST_MACRO_EXP_VIEW_COMPONENT_NAME,
    RUST_MIR_VIEW_COMPONENT_NAME,
    STACK_USAGE_VIEW_COMPONENT_NAME,
    TOOL_COMPONENT_NAME,
    TOOL_INPUT_VIEW_COMPONENT_NAME,
    TREE_COMPONENT_NAME,
} from './components.interfaces.js';
import {EventHub} from './event-hub.js';
import {EventMap} from './event-map.js';
import {IdentifierSet} from './identifier-set.js';
import {Ast as AstView} from './panes/ast-view.js';
import {Cfg as CfgView} from './panes/cfg-view.js';
import {Clangir as ClangirView} from './panes/clangir-view.js';
import {Compiler} from './panes/compiler.js';
import {Conformance as ConformanceView} from './panes/conformance-view.js';
import {DeviceAsm as DeviceView} from './panes/device-view.js';
import {Diff} from './panes/diff.js';
import {Editor} from './panes/editor.js';
import {Executor} from './panes/executor.js';
import {Flags as FlagsView} from './panes/flags-view.js';
import {GccDump as GCCDumpView} from './panes/gccdump-view.js';
import {GnatDebug as GnatDebugView} from './panes/gnatdebug-view.js';
import {GnatDebugTree as GnatDebugTreeView} from './panes/gnatdebugtree-view.js';
import {HaskellCmm as HaskellCmmView} from './panes/haskellcmm-view.js';
import {HaskellCore as HaskellCoreView} from './panes/haskellcore-view.js';
import {HaskellStg as HaskellStgView} from './panes/haskellstg-view.js';
import {Ir as IrView} from './panes/ir-view.js';
import {OptPipeline} from './panes/opt-pipeline.js';
import {Opt as OptView} from './panes/opt-view.js';
import {Output} from './panes/output.js';
import {PP as PreProcessorView} from './panes/pp-view.js';
import {RustHir as RustHirView} from './panes/rusthir-view.js';
import {RustMacroExp as RustMacroExpView} from './panes/rustmacroexp-view.js';
import {RustMir as RustMirView} from './panes/rustmir-view.js';
import {StackUsage as StackUsageView} from './panes/stack-usage-view.js';
import {ToolInputView} from './panes/tool-input-view.js';
import {Tool} from './panes/tool.js';
import {Tree} from './panes/tree.js';

type EventDescriptorMap = {
    [E in keyof EventMap]: [E, ...Parameters<EventMap[E]>];
};
export type EventDescriptor = EventDescriptorMap[keyof EventDescriptorMap];

export class Hub {
    public readonly editorIds: IdentifierSet = new IdentifierSet();
    public readonly compilerIds: IdentifierSet = new IdentifierSet();
    public readonly executorIds: IdentifierSet = new IdentifierSet();
    public readonly treeIds: IdentifierSet = new IdentifierSet();

    public trees: Tree[] = [];
    public editors: any[] = []; // typeof Editor

    public readonly compilerService: CompilerService;

    public deferred = true;
    public deferredEmissions: EventDescriptor[] = [];

    public lastOpenedLangId: LanguageKey | null;
    public subdomainLangId: string | undefined;
    public defaultLangId: LanguageKey;

    public constructor(
        public readonly layout: GoldenLayout,
        subLangId: string | undefined,
        defaultLangId: LanguageKey,
    ) {
        this.lastOpenedLangId = null;
        this.subdomainLangId = subLangId;
        this.defaultLangId = defaultLangId;
        this.compilerService = new CompilerService(this.layout.eventHub);

        layout.registerComponent(EDITOR_COMPONENT_NAME, (c: GLC, s: any) => this.codeEditorFactory(c, s));
        layout.registerComponent(COMPILER_COMPONENT_NAME, (c: GLC, s: any) => this.compilerFactory(c, s));
        layout.registerComponent(TREE_COMPONENT_NAME, (c: GLC, s: any) => this.treeFactory(c, s));
        layout.registerComponent(EXECUTOR_COMPONENT_NAME, (c: GLC, s: any) => this.executorFactory(c, s));
        layout.registerComponent(OUTPUT_COMPONENT_NAME, (c: GLC, s: any) => this.outputFactory(c, s));
        layout.registerComponent(TOOL_COMPONENT_NAME, (c: GLC, s: any) => this.toolFactory(c, s));
        layout.registerComponent(TOOL_INPUT_VIEW_COMPONENT_NAME, (c: GLC, s: any) => this.toolInputViewFactory(c, s));
        layout.registerComponent(DIFF_VIEW_COMPONENT_NAME, (c: GLC, s: any) => this.diffFactory(c, s));
        layout.registerComponent(OPT_VIEW_COMPONENT_NAME, (c: GLC, s: any) => this.optViewFactory(c, s));
        layout.registerComponent(STACK_USAGE_VIEW_COMPONENT_NAME, (c: GLC, s: any) => this.stackUsageViewFactory(c, s));
        layout.registerComponent(FLAGS_VIEW_COMPONENT_NAME, (c: GLC, s: any) => this.flagsViewFactory(c, s));
        layout.registerComponent(PP_VIEW_COMPONENT_NAME, (c: GLC, s: any) => this.ppViewFactory(c, s));
        layout.registerComponent(AST_VIEW_COMPONENT_NAME, (c: GLC, s: any) => this.astViewFactory(c, s));
        layout.registerComponent(IR_VIEW_COMPONENT_NAME, (c: GLC, s: any) => this.irViewFactory(c, s));
        layout.registerComponent(CLANGIR_VIEW_COMPONENT_NAME, (c: GLC, s: any) => this.clangirViewFactory(c, s));
        layout.registerComponent(OPT_PIPELINE_VIEW_COMPONENT_NAME, (c: GLC, s: any) => this.optPipelineFactory(c, s));
        // Historical LLVM-specific name preserved to keep old links working
        layout.registerComponent(LLVM_OPT_PIPELINE_VIEW_COMPONENT_NAME, (c: GLC, s: any) =>
            this.optPipelineFactory(c, s),
        );
        layout.registerComponent(DEVICE_VIEW_COMPONENT_NAME, (c: GLC, s: any) => this.deviceViewFactory(c, s));
        layout.registerComponent(RUST_MIR_VIEW_COMPONENT_NAME, (c: GLC, s: any) => this.rustMirViewFactory(c, s));
        layout.registerComponent(HASKELL_CORE_VIEW_COMPONENT_NAME, (c: GLC, s: any) =>
            this.haskellCoreViewFactory(c, s),
        );
        layout.registerComponent(HASKELL_STG_VIEW_COMPONENT_NAME, (c: GLC, s: any) => this.haskellStgViewFactory(c, s));
        layout.registerComponent(HASKELL_CMM_VIEW_COMPONENT_NAME, (c: GLC, s: any) => this.haskellCmmViewFactory(c, s));
        layout.registerComponent(GNAT_DEBUG_TREE_VIEW_COMPONENT_NAME, (c: GLC, s: any) =>
            this.gnatDebugTreeViewFactory(c, s),
        );
        layout.registerComponent(GNAT_DEBUG_VIEW_COMPONENT_NAME, (c: GLC, s: any) => this.gnatDebugViewFactory(c, s));
        layout.registerComponent(RUST_MACRO_EXP_VIEW_COMPONENT_NAME, (c: GLC, s: any) =>
            this.rustMacroExpViewFactory(c, s),
        );
        layout.registerComponent(RUST_HIR_VIEW_COMPONENT_NAME, (c: GLC, s: any) => this.rustHirViewFactory(c, s));
        layout.registerComponent(GCC_DUMP_VIEW_COMPONENT_NAME, (c: GLC, s: any) => this.gccDumpViewFactory(c, s));
        layout.registerComponent(CFG_VIEW_COMPONENT_NAME, (c: GLC, s: any) => this.cfgViewFactory(c, s));
        layout.registerComponent(CONFORMANCE_VIEW_COMPONENT_NAME, (c: GLC, s: any) =>
            this.conformanceViewFactory(c, s),
        );

        layout.eventHub.on(
            'editorOpen',
            function (this: Hub, id: number) {
                this.editorIds.add(id);
            },
            this,
        );
        layout.eventHub.on(
            'editorClose',
            function (this: Hub, id: number) {
                this.editorIds.remove(id);
            },
            this,
        );
        layout.eventHub.on(
            'compilerOpen',
            function (this: Hub, id: number) {
                this.compilerIds.add(id);
            },
            this,
        );
        layout.eventHub.on(
            'compilerClose',
            function (this: Hub, id: number) {
                this.compilerIds.remove(id);
            },
            this,
        );
        layout.eventHub.on(
            'treeOpen',
            function (this: Hub, id: number) {
                this.treeIds.add(id);
            },
            this,
        );
        layout.eventHub.on(
            'treeClose',
            function (this: Hub, id: number) {
                this.treeIds.remove(id);
            },
            this,
        );
        layout.eventHub.on(
            'executorOpen',
            function (this: Hub, id: number) {
                this.executorIds.add(id);
            },
            this,
        );
        layout.eventHub.on(
            'executorClose',
            function (this: Hub, id: number) {
                this.executorIds.remove(id);
            },
            this,
        );
        layout.eventHub.on(
            'languageChange',
            function (this: Hub, editorId: number, langId: LanguageKey) {
                this.lastOpenedLangId = langId;
            },
            this,
        );
    }

    public initLayout() {
        // To be called after setupSettings, as layout.init depends on them
        this.layout.init();
        this.undefer();
        this.layout.eventHub.emit('initialised');
    }

    public nextTreeId(): number {
        return this.treeIds.next();
    }

    public nextEditorId(): number {
        return this.editorIds.next();
    }

    public nextCompilerId(): number {
        return this.compilerIds.next();
    }

    public nextExecutorId(): number {
        return this.executorIds.next();
    }

    public createEventHub(): EventHub {
        return new EventHub(this, this.layout.eventHub);
    }

    public undefer(): void {
        this.deferred = false;
        const eventHub = this.layout.eventHub;
        const compilerEmissions: EventDescriptor[] = [];
        const nonCompilerEmissions: EventDescriptor[] = [];

        for (const emission of this.deferredEmissions) {
            if (emission[0] === 'compiler') {
                compilerEmissions.push(emission);
            } else {
                nonCompilerEmissions.push(emission);
            }
        }

        for (const args of nonCompilerEmissions) {
            // ts doesn't allow spreading a union of tuples

            eventHub.emit.apply(eventHub, args);
        }

        for (const args of compilerEmissions) {
            // ts doesn't allow spreading a union of tuples

            eventHub.emit.apply(eventHub, args);
        }

        this.deferredEmissions = [];
    }

    public getTreeById(id: number): Tree | undefined {
        return this.trees.find(t => t.id === id);
    }

    public removeTree(id: number) {
        this.trees = this.trees.filter(t => t.id !== id);
    }

    public hasTree(): boolean {
        return this.trees.length > 0;
    }

    public getTreesWithEditorId(editorId: number) {
        return this.trees.filter(tree => tree.multifileService.isEditorPartOfProject(editorId));
    }

    public getTrees(): Tree[] {
        return this.trees;
    }

    public getEditorById(id: number): Editor | undefined {
        return this.editors.find(e => e.id === id);
    }

    public removeEditor(id: number) {
        this.editors = this.editors.filter(e => e.id !== id);
    }

    // Layout getters

    public findParentRowOrColumn(elem: GoldenLayout.ContentItem): GoldenLayout.ContentItem | null {
        let currentElem: GoldenLayout.ContentItem | null = elem;
        while (currentElem) {
            if (currentElem.isRow || currentElem.isColumn) return currentElem;
            // currentElem.parent may be null, this is reflected in newer GoldenLayout versions but not the version
            // we're using. Making a cast here just to be precise about what's going on.
            currentElem = currentElem.parent as GoldenLayout.ContentItem | null;
        }
        return null;
    }

    public findParentRowOrColumnOrStack(elem: GoldenLayout.ContentItem): GoldenLayout.ContentItem | null {
        let currentElem: GoldenLayout.ContentItem | null = elem;
        while (currentElem) {
            if (currentElem.isRow || currentElem.isColumn || currentElem.isStack) return currentElem;
            // currentElem.parent may be null, this is reflected in newer GoldenLayout versions but not the version
            // we're using. Making a cast here just to be precise about what's going on.
            currentElem = currentElem.parent as GoldenLayout.ContentItem | null;
        }
        return null;
    }

    public findEditorInChildren(elem: GoldenLayout.ContentItem): GoldenLayout.ContentItem | boolean | null {
        const count = elem.contentItems.length;
        let index = 0;
        while (index < count) {
            const child = elem.contentItems[index];

            // @ts-expect-error -- GoldenLayout's types are messed up here. This
            // is a ContentItem, which can be a Component which has a componentName
            // property
            if (child.componentName === 'codeEditor') {
                return this.findParentRowOrColumnOrStack(child);
            }
            if (child.isRow || child.isColumn || child.isStack) {
                const editor = this.findEditorInChildren(child);
                if (editor) return editor;
            }
            index++;
        }
        return false;
    }

    public findEditorParentRowOrColumn(): GoldenLayout.ContentItem | boolean | null {
        return this.findEditorInChildren(this.layout.root);
    }

    public addInEditorStackIfPossible(elem: GoldenLayout.ItemConfig): void {
        const insertionPoint = this.findEditorParentRowOrColumn();
        // required not-true check because findEditorParentRowOrColumn returns
        // false if there is no editor parent
        if (insertionPoint && insertionPoint !== true) {
            insertionPoint.addChild(elem);
        } else {
            this.addAtRoot(elem);
        }
    }

    public addAtRoot(elem: GoldenLayout.ItemConfig): void {
        if (this.layout.root.contentItems.length > 0) {
            const rootFirstItem = this.layout.root.contentItems[0];
            if (rootFirstItem.isRow || rootFirstItem.isColumn) {
                rootFirstItem.addChild(elem);
            } else {
                // @ts-expect-error -- GoldenLayout's types are messed up here?
                const newRow: ContentItem = this.layout.createContentItem(
                    {
                        type: 'row',
                    },
                    this.layout.root,
                );
                this.layout.root.replaceChild(rootFirstItem, newRow);
                newRow.addChild(rootFirstItem);
                newRow.addChild(elem);
            }
        } else {
            this.layout.root.addChild({
                type: 'row',
                content: [elem],
            });
        }
    }

    public activateTabForContainer(container?: GLC) {
        if (container && (container.tab as typeof container.tab | null)) {
            container.tab.header.parent.setActiveContentItem(container.tab.contentItem);
        }
    }

    public hasOpenEditorsOrFiles() {
        return this.editors.length > 1 || this.getTrees().length > 0;
    }

    public updateCloseButtons(container) {
        // note: container can be of multiple dynamic types, must query properties instead of assuming they're there
        if (container.tab !== undefined) {
            // prohibit closing the editor if it is the only one
            if (this.hasOpenEditorsOrFiles()) {
                if (container.tab.header.tabs.length === 1 && container.tab.header.closeButton) {
                    container.tab.header.closeButton.element.show();
                }
                container.tab.header.tabs.forEach(tab => tab.closeElement.show());
            } else {
                if (container.tab.header.tabs.length === 1 && container.tab.header.closeButton) {
                    container.tab.header.closeButton.element.hide();
                }
                container.tab.header.tabs.forEach(tab => tab.closeElement.hide());
            }
        }
    }

    // Component Factories

    private codeEditorFactory(container: GoldenLayout.Container, state: any): Editor {
        // Ensure editors are closable: some older versions had 'isClosable' false.
        // NB there doesn't seem to be a better way to do this than reach into the config and rely on the fact nothing
        // has used it yet.
        container.parent.config.isClosable = true;
        _.defer(() => {
            this.updateCloseButtons(container);
        });
        const editor = new Editor(this, state, container);
        this.editors.push(editor);
        return editor;
    }

    private treeFactory(container: GoldenLayout.Container, state: ConstructorParameters<typeof Tree>[2]): Tree {
        const tree = new Tree(this, container, state);
        this.trees.push(tree);
        return tree;
    }

    public compilerFactory(container: GoldenLayout.Container, state: any): any /* typeof Compiler */ {
        return new Compiler(this, container, state);
    }

    public executorFactory(container: GoldenLayout.Container, state: any): any /*typeof Executor */ {
        return new Executor(this, container, state);
    }

    public outputFactory(container: GoldenLayout.Container, state: ConstructorParameters<typeof Output>[2]): Output {
        return new Output(this, container, state);
    }

    public toolFactory(container: GoldenLayout.Container, state: any): any /* typeof Tool */ {
        return new Tool(this, container, state);
    }

    public diffFactory(container: GoldenLayout.Container, state: any): any /* typeof Diff */ {
        return new Diff(this, container, state);
    }

    public toolInputViewFactory(
        container: GoldenLayout.Container,
        state: ConstructorParameters<typeof ToolInputView>[2],
    ): ToolInputView {
        return new ToolInputView(this, container, state);
    }

    public optViewFactory(container: GoldenLayout.Container, state: ConstructorParameters<typeof OptView>[2]): OptView {
        return new OptView(this, container, state);
    }

    public stackUsageViewFactory(
        container: GoldenLayout.Container,
        state: ConstructorParameters<typeof StackUsageView>[2],
    ): StackUsageView {
        return new StackUsageView(this, container, state);
    }

    public flagsViewFactory(
        container: GoldenLayout.Container,
        state: ConstructorParameters<typeof FlagsView>[2],
    ): FlagsView {
        return new FlagsView(this, container, state);
    }

    public ppViewFactory(
        container: GoldenLayout.Container,
        state: ConstructorParameters<typeof PreProcessorView>[2],
    ): PreProcessorView {
        return new PreProcessorView(this, container, state);
    }

    public astViewFactory(container: GoldenLayout.Container, state: ConstructorParameters<typeof AstView>[2]): AstView {
        return new AstView(this, container, state);
    }

    public irViewFactory(container: GoldenLayout.Container, state: ConstructorParameters<typeof IrView>[2]): IrView {
        return new IrView(this, container, state);
    }

    public clangirViewFactory(
        container: GoldenLayout.Container,
        state: ConstructorParameters<typeof ClangirView>[2],
    ): ClangirView {
        return new ClangirView(this, container, state);
    }

    public optPipelineFactory(
        container: GoldenLayout.Container,
        state: ConstructorParameters<typeof OptPipeline>[2],
    ): OptPipeline {
        return new OptPipeline(this, container, state);
    }

    public deviceViewFactory(
        container: GoldenLayout.Container,
        state: ConstructorParameters<typeof DeviceView>[2],
    ): DeviceView {
        return new DeviceView(this, container, state);
    }

    public gnatDebugTreeViewFactory(
        container: GoldenLayout.Container,
        state: ConstructorParameters<typeof GnatDebugTreeView>[2],
    ): GnatDebugTreeView {
        return new GnatDebugTreeView(this, container, state);
    }

    public gnatDebugViewFactory(
        container: GoldenLayout.Container,
        state: ConstructorParameters<typeof GnatDebugView>[2],
    ): GnatDebugView {
        return new GnatDebugView(this, container, state);
    }

    public rustMirViewFactory(
        container: GoldenLayout.Container,
        state: ConstructorParameters<typeof RustMirView>[2],
    ): RustMirView {
        return new RustMirView(this, container, state);
    }

    public rustMacroExpViewFactory(
        container: GoldenLayout.Container,
        state: ConstructorParameters<typeof RustMacroExpView>[2],
    ): RustMacroExpView {
        return new RustMacroExpView(this, container, state);
    }

    public rustHirViewFactory(
        container: GoldenLayout.Container,
        state: ConstructorParameters<typeof RustHirView>[2],
    ): RustHirView {
        return new RustHirView(this, container, state);
    }

    public haskellCoreViewFactory(
        container: GoldenLayout.Container,
        state: ConstructorParameters<typeof HaskellCoreView>[2],
    ): HaskellCoreView {
        return new HaskellCoreView(this, container, state);
    }

    public haskellStgViewFactory(
        container: GoldenLayout.Container,
        state: ConstructorParameters<typeof HaskellStgView>[2],
    ): HaskellStgView {
        return new HaskellStgView(this, container, state);
    }
    public haskellCmmViewFactory(
        container: GoldenLayout.Container,
        state: ConstructorParameters<typeof HaskellCmmView>[2],
    ): HaskellCmmView {
        return new HaskellCmmView(this, container, state);
    }

    public gccDumpViewFactory(container: GoldenLayout.Container, state: any): any /* typeof GccDumpView */ {
        return new GCCDumpView(this, container, state);
    }

    public cfgViewFactory(container: GoldenLayout.Container, state: ConstructorParameters<typeof CfgView>[2]): CfgView {
        return new CfgView(this, container, state);
    }

    public conformanceViewFactory(container: GoldenLayout.Container, state: any): any /* typeof ConformanceView */ {
        return new ConformanceView(this, container, state);
    }
}
