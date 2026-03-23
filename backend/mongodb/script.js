const API = "http://localhost:3000/users"

let editId = null

const nameInput = document.getElementById("name")
const emailInput = document.getElementById("email")
const addBtn = document.getElementById("addBtn")
const updateBtn = document.getElementById("updateBtn")
const table = document.getElementById("userTable")

addBtn.addEventListener("click", createUser)
updateBtn.addEventListener("click", updateUser)

window.onload = getUsers


async function getUsers(){

    const res = await fetch(API)
    const users = await res.json()

    table.innerHTML = ""

    users.forEach(user => {

        table.innerHTML += `
        <tr>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>
                <button class="edit" onclick="editUser('${user._id}','${user.name}','${user.email}')">Edit</button>
                <button class="delete" onclick="deleteUser('${user._id}')">Delete</button>
            </td>
        </tr>
        `
    })

}


async function createUser(){

    const name = nameInput.value
    const email = emailInput.value

    if(!name || !email){
        alert("Enter all fields")
        return
    }

    await fetch(API,{
        method:"POST",
        headers:{
            "Content-Type":"application/json"
        },
        body:JSON.stringify({name,email})
    })

    nameInput.value=""
    emailInput.value=""

    getUsers()

}


function editUser(id,name,email){

    editId = id

    nameInput.value = name
    emailInput.value = email

    addBtn.style.display="none"
    updateBtn.style.display="inline-block"

}


async function updateUser(){

    const name = nameInput.value
    const email = emailInput.value

    await fetch(`${API}/${editId}`,{
        method:"PUT",
        headers:{
            "Content-Type":"application/json"
        },
        body:JSON.stringify({name,email})
    })

    nameInput.value=""
    emailInput.value=""

    addBtn.style.display="inline-block"
    updateBtn.style.display="none"

    getUsers()

}


async function deleteUser(id){

    await fetch(`${API}/${id}`,{
        method:"DELETE"
    })

    getUsers()

}