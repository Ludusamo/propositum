/*global firebase, moment*/
/*eslint no-undef: "error"*/

import * as Tessellation from './tessellation/tessellation.js'

const emptyTask =
  [ null
  , { 'description': ''
    , 'tags': []
    , 'due': null
    , 'name': ''
    , 'priority': ''
    , 'completed': false
    }
  ]

const clearTaskList = () => {
  for (let ele of document.getElementsByTagName('task-list')) {
    ele.remove()
  }
}

const refresh = user => {
  clearTaskList()
  populateTasks(user)
}

const aggregateTaskData = () => {
  let data = {}
  let inputs = document.getElementsByClassName('input')
  for (let input of inputs) {
    let val = null
    if (input.id === 'description') {
      val = input.innerHTML
    } else if (input.id === 'tags') {
      val = input.value.split(',')
    } else if (input.id === 'due') {
      val = input.valueAsDate
    } else if (input.id === 'completed') {
      val = input.checked
    } else {
      val = input.value
    }
    data[input.id] = val
  }
  return data
}

const fillForm = task => {
  for (let key in task[1]) {
    let ele = document.getElementById(key)
    let val = task[1][key] ? task[1][key] : null
    if (!ele) continue
    if (key === 'description') {
      ele.innerHTML = val
    } else if (key === 'tags') {
      ele.value = val.join(',')
    } else if (key === 'due') {
      ele.valueAsDate = val ? val.toDate() : val
    } else if (key === 'completed') {
      ele.checked = val
    } else {
      ele.value = val
    }
  }
  document.getElementById('submit').onclick = () => {
    if (!task[0]) {
      firebase.firestore()
        .collection('tasks')
        .add(aggregateTaskData())
        .then(() => {
          addTaskModal.style.display = 'none'
          refresh(true)
        })
    } else {
      firebase.firestore()
        .collection('tasks')
        .doc(task[0])
        .set(aggregateTaskData())
        .then(() => {
          addTaskModal.style.display = 'none'
          refresh(true)
        })
    }
  }
}

const openForm = (header, task) => {
  document.getElementById('form-header').innerHTML = header
  addTaskModal.style.display = 'block'
  fillForm(task)
}

const onEditClick = task => {
  return () => {
    openForm('Edit Task:', task)
  }
}

const populateTasks = (user) => {
  // Grab data from firestore
  const fstore = firebase.firestore()
  let tasksColl = fstore.collection('tasks')
  if (!user) {
    tasksColl = tasksColl.where("public", "==", true)
    console.log('no user')
  }
  const tasks = {}
  tasksColl
    .get()
    .then(snapshot => {
      snapshot.forEach(task => {
        tasks[task.id] = task.data()
      })
      const taskList = Tessellation.RenderJSON(tasks, PropositumTemplate)
      if (user) {
        for (let task of taskList.children) {
          task.classList.add('hoverable-task')
          task.onclick = onEditClick([task.id, tasks[task.id]])
        }
      }
      document.body.appendChild(taskList)
    })
}

firebase.auth().onAuthStateChanged(user => {
  document.getElementById('admin-panel').style.display = user ? 'flex' : 'none'
  refresh(user)
})

document.getElementById('logout').onclick = () => {
  firebase.auth()
    .signOut()
    .then(() => {
      console.log('successfully logged out')
    }).catch(error => {
      // TODO: add a popup
      console.log('failed to logout')
      console.log(error)
    })
}

// Add Task Modal
let addTaskModal = document.getElementsByTagName('add-task-modal')[0]
let addTaskBtn = document.getElementById('add-task')
let closeSpan = document.getElementById('close-add-task')

addTaskBtn.onclick = () => {
  openForm('Add Task:', emptyTask)
}

closeSpan.onclick = () => {
  addTaskModal.style.display = 'none'
}

window.onclick = (event) => {
  if (event.target == addTaskModal) {
    addTaskModal.style.display = 'none'
  }
}

// Rendering

const createElement = (name, innerHTML, classes=[]) => {
  const ele = document.createElement(name)
  ele.innerHTML = innerHTML
  ele.classList.add(...classes)
  return ele
}

const TagRenderer = (tag) => createElement('tag', tag, ['chip'])

const TagsRenderer = (tags) => {
  const tagsEle = document.createElement('tags')
  tagsEle.append(...tags.map(t => TagRenderer(t)))
  return tagsEle
}

const TaskHeaderRenderer = (task) => {
  const taskHeader = document.createElement('task-header')
  const title = createElement('task-title', task.name)
  const completed = createElement('completed', 'Completed: ' + (task.completed ? '\u2705' : '\u274c'))
  const priority = createElement('priority', 'Priority: ' + task.priority)
  const dueDate = createElement('due-date', 'Due: ' + (task.due ? moment(task.due.toDate()).format('ll') : 'N/A'))
  taskHeader.append(title, completed, priority, dueDate)
  return taskHeader
}

const TaskRenderer = (task) => {
  const taskEle = document.createElement('task')
  const header = TaskHeaderRenderer(task)
  const description = createElement('description', task.description)
  const tags = TagsRenderer(task.tags)
  taskEle.append(header, description, tags)
  return taskEle
}

const TaskListRenderer = (tasks) => {
  let container = document.createElement('task-list')
  for (const id in tasks) {
    const task = tasks[id]
    let taskListEle = TaskRenderer(task)
    taskListEle.id = id
    container.appendChild(taskListEle)
  }
  return container
}

const PropositumTemplate =
  { ...Tessellation.DefaultRendererTemplate
  , 'object': TaskListRenderer
  }
