const express = require('express');
const router = express.Router();
const userController = require('../controller/userController')

router.get('/users' , userController.getUsers)
router.post('/users' , userController.createUser)
router.put('/users/:id' , userController.updateUser)
router.delete('/users/:id' , userController.deleteUser)
router.get('/users/:id' , userController.getUserById)
module.exports = router