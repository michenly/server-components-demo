"use strict";
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
exports.getSource = exports.resolve = void 0;
const acorn = __importStar(require("acorn"));
let warnedAboutConditionsFlag = false;
let stashedGetSource = null;
let stashedResolve = null;
async function resolve(specifier, context, defaultResolve) {
    // We stash this in case we end up needing to resolve export * statements later.
    stashedResolve = defaultResolve;
    if (!context.conditions.includes('react-server')) {
        context = Object.assign(Object.assign({}, context), { conditions: [...context.conditions, 'react-server'] });
        if (!warnedAboutConditionsFlag) {
            warnedAboutConditionsFlag = true;
            // eslint-disable-next-line react-internal/no-production-logging
            console.warn('You did not run Node.js with the `--conditions react-server` flag. ' +
                'Any "react-server" override will only work with ESM imports.');
        }
    }
    const resolved = await defaultResolve(specifier, context, defaultResolve);
    if (resolved.url.endsWith('.server.js')) {
        const parentURL = context.parentURL;
        if (parentURL && !parentURL.endsWith('.server.js')) {
            let reason;
            if (specifier.endsWith('.server.js')) {
                reason = `"${specifier}"`;
            }
            else {
                reason = `"${specifier}" (which expands to "${resolved.url}")`;
            }
            throw new Error(`Cannot import ${reason} from "${parentURL}". ` +
                'By react-server convention, .server.js files can only be imported from other .server.js files. ' +
                'That way nobody accidentally sends these to the client by indirectly importing it.');
        }
    }
    return resolved;
}
exports.resolve = resolve;
async function getSource(url, context, defaultGetSource) {
    // We stash this in case we end up needing to resolve export * statements later.
    stashedGetSource = defaultGetSource;
    return defaultGetSource(url, context, defaultGetSource);
}
exports.getSource = getSource;
function addExportNames(names, node) {
    switch (node.type) {
        case 'Identifier':
            names.push(node.name);
            return;
        case 'ObjectPattern':
            for (let i = 0; i < node.properties.length; i++)
                addExportNames(names, node.properties[i]);
            return;
        case 'ArrayPattern':
            for (let i = 0; i < node.elements.length; i++) {
                const element = node.elements[i];
                if (element)
                    addExportNames(names, element);
            }
            return;
        case 'Property':
            addExportNames(names, node.value);
            return;
        case 'AssignmentPattern':
            addExportNames(names, node.left);
            return;
        case 'RestElement':
            addExportNames(names, node.argument);
            return;
        case 'ParenthesizedExpression':
            addExportNames(names, node.expression);
            return;
    }
}
function resolveClientImport(specifier, parentURL) {
    // Resolve an import specifier as if it was loaded by the client. This doesn't use
    // the overrides that this loader does but instead reverts to the default.
    // This resolution algorithm will not necessarily have the same configuration
    // as the actual client loader. It should mostly work and if it doesn't you can
    // always convert to explicit exported names instead.
    const conditions = ['node', 'import'];
    if (stashedResolve === null) {
        throw new Error('Expected resolve to have been called before transformSource');
    }
    return stashedResolve(specifier, { conditions, parentURL }, stashedResolve);
}
async function loadClientImport(url, loadModule) {
    if (stashedGetSource === null) {
        throw new Error('Expected getSource to have been called before transformSource');
    }
    // TODO: Validate that this is another module by calling getFormat.
    const { source } = await stashedGetSource(url, { format: 'module' }, stashedGetSource);
    // TODO: transpile depdendencies with `loadModule`.
    console.log(source, url);
    return { source: '' };
    // return defaultTransformSource(
    //   source,
    //   {format: 'module', url},
    //   defaultTransformSource,
    // );
}
async function parseExportNamesInto(transformedSource, names, parentURL, loadModule) {
    const { body } = acorn.parse(transformedSource, {
        ecmaVersion: 2019,
        sourceType: 'module',
    });
    for (let i = 0; i < body.length; i++) {
        const node = body[i];
        switch (node.type) {
            case 'ExportAllDeclaration':
                if (node.exported) {
                    addExportNames(names, node.exported);
                    continue;
                }
                else {
                    const { url } = await resolveClientImport(node.source.value, parentURL);
                    const { source } = await loadClientImport(url, loadModule);
                    if (typeof source !== 'string') {
                        throw new Error('Expected the transformed source to be a string.');
                    }
                    parseExportNamesInto(source, names, url, loadModule);
                    continue;
                }
            case 'ExportDefaultDeclaration':
                names.push('default');
                continue;
            case 'ExportNamedDeclaration':
                if (node.declaration) {
                    if (node.declaration.type === 'VariableDeclaration') {
                        const declarations = node.declaration.declarations;
                        for (let j = 0; j < declarations.length; j++) {
                            addExportNames(names, declarations[j].id);
                        }
                    }
                    else {
                        addExportNames(names, node.declaration.id);
                    }
                }
                if (node.specificers) {
                    const specificers = node.specificers;
                    for (let j = 0; j < specificers.length; j++) {
                        addExportNames(names, specificers[j].exported);
                    }
                }
                continue;
        }
    }
}
async function transformSource(source) {
    const url = this.resourcePath;
    const transformedSource = source;
    if (typeof transformedSource !== 'string') {
        throw new Error('Expected source to have been transformed to a string.');
    }
    const names = [];
    await parseExportNamesInto(transformedSource, names, url, this.loadModule);
    let newSrc = "const MODULE_REFERENCE = Symbol.for('react.module.reference');\n";
    for (let i = 0; i < names.length; i++) {
        const name = names[i];
        if (name === 'default') {
            newSrc += 'export default ';
        }
        else {
            newSrc += 'export const ' + name + ' = ';
        }
        newSrc += '{ $$typeof: MODULE_REFERENCE, filepath: ';
        newSrc += JSON.stringify(url);
        newSrc += ', name: ';
        newSrc += JSON.stringify(name);
        newSrc += '};\n';
    }
    return newSrc;
}
exports.default = transformSource;
