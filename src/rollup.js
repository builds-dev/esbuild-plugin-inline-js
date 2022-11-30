import pkg from '../package.json' assert { type: 'json' }
import {
	get_inline_js,
	virtual_module_id_prefix
} from './index.js'

const name = pkg.name
const meta = Symbol()

export const inline_js = () => {
	return {
		name,
		resolveId (source, importer, options) {
			return source.startsWith(virtual_module_id_prefix)
				?
					{
						id: source.slice(virtual_module_id_prefix.length),
						meta: {
							[meta]: { importer, options }
						}
					}
				:
					null
		},
		async load (id) {
			const module_info = this.getModuleInfo(id)
			if (module_info.meta[meta]) {
				const { importer, options } = module_info.meta[meta]
				const resolution = await this.resolve(id, importer, options)
				return { code: await get_inline_js(resolution.id) }
			}
			return null
		}
	}
}
