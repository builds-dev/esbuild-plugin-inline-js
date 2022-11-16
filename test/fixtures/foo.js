import { baz } from './baz.js'
import { bar } from './bar.js'

export const foo = x => 'foo' + x + bar('d')

export default foo('t') + baz('k')
