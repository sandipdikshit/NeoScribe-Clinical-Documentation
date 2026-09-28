"use strict";

var express = require("express");
var router = express.Router();

require('./authentication')(router);

module.exports = router

