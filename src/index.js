import esbuild from 'esbuild'
import * as recast from 'recast'

export const virtual_module_id_prefix = 'virtual:inline_js:'

const export_const = (name, value) => ({
	type: 'ExportNamedDeclaration',
	declaration: {
		type: 'VariableDeclaration',
		declarations: [
			{
				type: 'VariableDeclarator',
				id: {
					type: 'Identifier',
					name,
				},
				init: value
			}
		],
		kind: 'const'
	}
})

const export_default = value => ({
	type: 'ExportDefaultDeclaration',
	declaration: value
})

export const get_inline_js = async path => {
	/*
		NOTE: recast.parse uses esprima by default,
			which does not currently support newer JS features like the spread operator.
			Either target es6 with esbuild, or configure recast with a different parser.
	*/
	/*
		TODO: this bundling step should probably be pushed out of here, and maybe just included with the library as a helper or within some other convenient way of pre-processing the code at the path. In that case, it's probably best to configure recast with a parser than can handle modern JS.
	*/
	const bundle = await esbuild.build({
		entryPoints: [ path ],
		bundle: true,
		write: false,
		format: 'esm',
		minify: true,
		sourcemap: 'inline',
		target: 'es6'
	})
	const bundle_code = bundle.outputFiles[0].text
	const ast = recast.parse(bundle_code)
	const references = []
	const export_specifiers = []

	for (const node of ast.program.body) {
		if (node.type === 'ExportNamedDeclaration') {
			export_specifiers.push(...node.specifiers)
		} else {
			// types known to be here: 'FunctionDeclaration', 'VariableDeclaration'
			references.push(node)
		}
	}

	/*
		This makes a string of all the top level references,
		which is unfortunately dumped into the scope for each export
		even though an export may only be using some of them.
	*/
	const references_code = recast
		.print({ type: 'Program', body: references })
		.code

	ast.program.body = export_specifiers.map(specifier => {
		const value = {
			type: 'Literal',
			value: `${references_code} return ${specifier.local.name}`
		}

		return specifier.exported.name === 'default'
			? export_default (value)
			: export_const (specifier.exported.name, value)
	})

	return recast.print(ast).code
}
