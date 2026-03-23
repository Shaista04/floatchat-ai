const User = require('../model/userModal')

exports.getUsers = async (req , res)=>{
    const users = await User.find()
    res.status(200).json(users)
}

exports.createUser = async (req , res)=>{
    const user = new User(req.body)
    await user.save()
    res.status(201).json(user)
}

exports.updateUser =  async (req , res)=>{
    const user = await User.findByIdAndUpdate(req.params.id , req.body,{new : true})
    res.status(200).json(user)
}

exports.deleteUser = async (req , res)=>{
    await User.findByIdAndDelete(req.params.id) 
} 

exports.getUserById = async (req , res)=>{
    const user = await User.findById(req.params.id)
    res.status(200).json(user)
}