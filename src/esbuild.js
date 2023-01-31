import pkg from '../package.json' assert { type: 'json' }
import {
	get_inline_js,
	virtual_module_id_prefix
} from './index.js'

const name = pkg.name
const namespace = name

export const inline_js = () => ({
	name,
	setup (build) {
		build.onResolve(
			{
				filter: new RegExp('^' + virtual_module_id_prefix)
			},
			async ({ path, resolveDir, importer }) => ({
				path: await build.resolve(
					path.slice(virtual_module_id_prefix.length),
					{
						kind: 'import-statement',
						resolveDir
					}
				)
					.then(x => x.path)
				,
				namespace
			})
		)

		build.onLoad(
			{
				filter: /.*/, namespace
			},
			async ({ path }) => ({
				contents: await get_inline_js(path),
				loader: 'js'
			})
		)
	}
})
