// 正则，ip/域名
const urlRegexp1 = /(http(s?):\/\/\d{1,3}(\.\d{1,3}){3}:\d{1,4}(\/?)(,?))+/g
const urlRegexp2 =
  /(http(s?):\/\/(www\.)?([a-zA-Z0-9\?\_\=\-\.\/\\]+(\.[a-zA-Z0-9\?\_\=\-\.\/\\]+)*)(\/?)(,?))+/g

// 整理自《JavaScript高级程序设计（第4版）》、《JavaScript语言精粹》
// 关键字与保留字
const specialWords = [
  'abstract', 'async', 'await', 'boolean',
  'break', 'byte', 'case', 'catch',
  'char', 'class', 'const', 'continue',
  'debugger', 'default', 'delete', 'do',
  'double', 'else', 'enum', 'export',
  'extends', 'false', 'final', 'finally',
  'float', 'for', 'function', 'goto',
  'Infinity', 'if', 'implements', 'import',
  'in', 'instanceof', 'int', 'interface',
  'let', 'long', 'NaN', 'native',
  'new', 'null', 'package', 'private',
  'protected', 'public', 'return', 'short',
  'static', 'super', 'switch', 'synchronized',
  'this', 'throw', 'throws', 'transient',
  'true', 'try', 'typeof', 'undefined',
  'var', 'void', 'volatile', 'while',
  'with', 'yield'
]

module.exports = {
  urlRegexp1,
  urlRegexp2,
  specialWords
}
