import { parse } from 'babylon';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { transformFromAst } from '@babel/core';
import { esmModuleSystemUsed, commonJSModuleSystemUsed } from './settings';


export const codeToAst = code => parse(code, {
    plugins: [
        "typescript",
        "jsx"
    ],
    sourceType: "module"
});


export function getIdentifier(code) {
    const identifiers = [];
    const Visitor = {
        Identifier(path) {
            if ((path.parentPath.parent.type === 'Program' || path.parentPath.parent.type === 'File') && path.listKey !== 'params') {
                identifiers.push(path.node.name);
            }
        }
    };

    traverse(codeToAst(code), Visitor);

    return identifiers;
}

function assignment(value) {
    return t.assignmentExpression(
        '=',
        t.memberExpression(
            t.identifier('module'),
            t.identifier('exports'),
            false
        ),
        value
    );
}


function generateExportsExpr(value) {
    return t.expressionStatement(assignment(value));
};

export function generateImportStatementFromFile(identifiers, modulePath) {
    const identifiersString = identifiers.join(', ')
    if (esmModuleSystemUsed()) {
        return `import { ${identifiersString} } from './${modulePath}';\n`;
    } else if (commonJSModuleSystemUsed()) {
        return `const { ${identifiersString} } = require('./${modulePath}');\n`;
    }
}

export function exportAllDeclarationsESM(code) {
    const ast = codeToAst(code);

    const visitor = {
        Declaration(path) {
            if (path.parent.type === 'Program' && !path.node.type.includes('Export')) {
                path.replaceWith(t.exportNamedDeclaration(path.node, []));
            }
        }
    };

    traverse(ast, visitor);

    return transformFromAst(ast).code;
}

export function exportAllDeclarationsCommonJS(code) {
    const identifiers = getIdentifier(code).map(id => t.objectProperty(t.identifier(id), t.identifier(id), false, true));
    const exportExpression = generateExportsExpr(t.objectExpression(identifiers));
    const ast = t.file(t.program([exportExpression]), '', '');
    return `
${code}
    
${transformFromAst(ast).code}
        `;
}


export function transformJSIntoExportExpressions(code) {
    if (esmModuleSystemUsed()) {
        return exportAllDeclarationsESM(code);
    } else if (commonJSModuleSystemUsed()) {
        return exportAllDeclarationsCommonJS(code);
    }
}