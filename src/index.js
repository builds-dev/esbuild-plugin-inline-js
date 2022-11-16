import esbuild from 'esbuild'
import * as recast from 'recast'
import pkg from '../package.json' assert { type: 'json' }

const name = pkg.name
const namespace = name
const virtual_module_id_prefix = 'virtual:inline_js:'

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

const _var = declarators => ({
	kind: 'var',
	type: 'VariableDeclaration',
	declarations: declarators
})

export const inline_js = () => ({
	name,
	setup (build) {
		build.onResolve(
			{
				filter: new RegExp('^' + virtual_module_id_prefix)
			},
			async ({ path, resolveDir, importer }) => ({
				path: await build.resolve(path.slice(virtual_module_id_prefix.length), { resolveDir })
					.then(x => x.path)
				,
				namespace
			})
		)

		build.onLoad(
			{
				filter: /.*/, namespace
			},
			async ({ path }) => {
				const bundle = await esbuild.build({
					entryPoints: [ path ],
					bundle: true,
					write: false,
					format: 'esm',
					minify: true,
					sourcemap: 'inline',
					target: 'esnext'
				})
				const bundle_code = bundle.outputFiles[0].text
				const ast = recast.parse(bundle_code)
				const original = {
					variable_declarators: {},
					export_specifiers: []
				}
				const processed = {
					variable_declarators: [],
					export_specifiers: []
				}
				for (const node of ast.program.body) {
					if (node.type === 'VariableDeclaration') {
						for (const declarator of node.declarations) {
							original.variable_declarators[declarator.id.name] = declarator
						}
					} else if (node.type === 'ExportNamedDeclaration') {
						original.export_specifiers.push(...node.specifiers)
					}
				}

				/*
					This makes a string of all the variables,
					which is unfortunately dumped into the scope for each export,
					even though an export may only be using some of them.
				*/
				const variables_code = recast
					.print(_var(Object.values(original.variable_declarators)))
					.code

				ast.program.body = original.export_specifiers.map(specifier => {
					/*
						// TODO: insert only the needed variable declaractors. GLHF.
						const local_variable_declarator = original.variable_declarators[specifier.local.name]
						const in_scope = { ...original.variable_declarators }
						const variables_code = recast
							.print(
								_var([
									do_something_with_this(local_variable_declarator.init)
								])
							)
							.code
					*/
					const value = {
						type: 'Literal',
						value: `${variables_code} return ${specifier.local.name}`
					}

					return specifier.exported.name === 'default'
						? export_default (value)
						: export_const (specifier.exported.name, value)
				})

				return {
					contents: recast.print(ast).code,
					loader: 'js'
				}
			}
		)
	}
})
