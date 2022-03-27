const checkFns = require('./checkFns')
const constant = require('./constant')
const calculateObj = require('./calculateObj')
const folderObj = require('./folderObj')

module.exports = {
  ...checkFns,
  ...constant,
  calculateObj,
  folderObj
}
