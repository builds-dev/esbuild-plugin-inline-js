import { join as join_path } from 'node:path'
import { fileURLToPath } from 'node:url'
import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import { build } from 'esbuild'
import pkg from '../package.json' assert { type: 'json' }
import { inline_js } from '../src/esbuild.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const test = suite(pkg.name)

const js_data_uri = string =>
	`data:text/javascript;base64,${Buffer.from(string).toString(`base64`)}`

test('', async () => {
	const bundle = await build({
		bundle: true,
		entryPoints: [ join_path(__dirname, 'fixtures', 'main.js') ],
		format: 'esm',
		platform: 'node',
		plugins: [
			inline_js()
		],
		write: false
	})
	
	const original_module = await import(join_path(__dirname, 'fixtures', 'foo.js'))
	const module = await import(js_data_uri(bundle.outputFiles[0].text))
	assert.equal(typeof module.default, 'string')
	assert.equal(typeof module.foo, 'string')
	assert.equal(new Function(module.default)(), 'footbardbazk')
	assert.equal(new Function(module.foo)()('l'), 'foolbard')
	assert.equal(new Function(module.default)(), original_module.default)
	assert.equal(new Function(module.foo)()('l'), original_module.foo('l'))
})

test.run()
