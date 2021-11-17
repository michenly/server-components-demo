"use strict";
// Exclude all server modules in the client bundle.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const acorn = __importStar(require("acorn"));
async function parseExportNamesInto(transformedSource, imports) {
    const { body } = acorn.parse(transformedSource, {
        ecmaVersion: 2019,
        sourceType: 'module',
    });
    for (let i = 0; i < body.length; i++) {
        const node = body[i];
        switch (node.type) {
            case 'ImportDeclaration':
                // When importing from a server component, ignore
                if (!/\.client(\.(js|ts)x?)?/.test(node.source.value)) {
                    continue;
                }
                let defaultNode = null;
                let otherNodes = [];
                for (let specifier of node.specifiers) {
                    if (specifier.type === 'ImportDefaultSpecifier') {
                        defaultNode = specifier.local.name;
                    }
                    else {
                        otherNodes.push(specifier.local.name);
                    }
                }
                imports.push(`import ${defaultNode ? defaultNode : ''}${defaultNode && otherNodes.length ? ',' : ''}${otherNodes.length ? `{${otherNodes.join(',')}}` : ''} from '${node.source.value}'`);
                continue;
        }
    }
}
async function transformSource(source) {
    const transformedSource = source;
    if (typeof transformedSource !== 'string') {
        throw new Error('Expected source to have been transformed to a string.');
    }
    const imports = [];
    await parseExportNamesInto(transformedSource, imports);
    return imports.join('\n') + '\nexport default () => {}';
}
exports.default = transformSource;
