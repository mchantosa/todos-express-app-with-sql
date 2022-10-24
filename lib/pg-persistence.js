const { Client } = require("pg");
const { dbQuery } = require("./db-query");

module.exports = class PgPersistence {

  constructor(session) {
    
    // this._todoLists = session.todoLists || deepCopy(SeedData);
    // session.todoLists = this._todoLists;
  }

  // Returns a new list of todo lists partitioned by completion status.
  _partitionTodoLists(todoLists) {
    let undone = [];
    let done = [];

    todoLists.forEach(todoList => {
      if (this.isDoneTodoList(todoList)) {
        done.push(todoList);
      } else {
        undone.push(todoList);
      }
    });

    return undone.concat(done);
  }

  // Are all of the todos in the todo list done? If the todo list has at least
  // one todo and all of its todos are marked as done, then the todo list is
  // done. Otherwise, it is undone.
  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }


  // Returns a promise that resolves to a sorted list of all the todo lists
  // together with their todos. The list is sorted by completion status and
  // title (case-insensitive). The todos in the list are unsorted.
  async sortedTodoLists() {
    const ALL_TODOLISTS = "SELECT * FROM todolists ORDER BY lower(title) ASC";
    const FIND_TODOS = "SELECT * FROM todos WHERE todolist_id = $1";

    let result = await dbQuery(ALL_TODOLISTS);
    let todoLists = result.rows;

    for (let index = 0; index < todoLists.length; ++index) {
      let todoList = todoLists[index];
      let todos = await dbQuery(FIND_TODOS, todoList.id);
      todoList.todos = todos.rows;
    }

    return this._partitionTodoLists(todoLists);
  }

  // Returns a promise that resolves to the todo list with the specified ID. The
  // todo list contains the todos for that list. The todos are not sorted. The
  // Promise resolves to `undefined` if the todo list is not found.
  async loadTodoList(todoListId) {
    const FIND_TODOLIST = "SELECT * FROM todolists WHERE id = $1";
    const FIND_TODOS = "SELECT * FROM todos WHERE todolist_id = $1";

    let resultTodoList = dbQuery(FIND_TODOLIST, todoListId);
    let resultTodos = dbQuery(FIND_TODOS, todoListId);
    let resultBoth = await Promise.all([resultTodoList, resultTodos]);
    let todoList = resultBoth[0].rows[0];

    // let resultTodoList = await dbQuery(FIND_TODOLIST, todoListId);
    // let todoList = resultTodoList.rows[0];

    if (!todoList) return undefined;
    todoList.todos = resultBoth[1].rows;
    return todoList;
  }

  // Does the todo list have any undone todos? Returns true if yes, false if no.
  hasUndoneTodos(todoList) {
    return todoList.todos.some(todo => !todo.done);
  }

  // Returns a promise that resolves to a sorted list of all the todos in the
  // specified todo list. The list is sorted by completion status and title
  // (case-insensitive).
  async sortedTodos(todoList) {
    const SORTED_TODOS = "SELECT * FROM todos" +
                         "  WHERE todolist_id = $1" +
                         "  ORDER BY done ASC, lower(title) ASC";

    let result = await dbQuery(SORTED_TODOS, todoList.id);
    return result.rows;
  }

  // Returns a copy of the indicated todo in the indicated todo list. Returns
  // `undefined` if either the todo list or the todo is not found. Note that
  // both IDs must be numeric.
  async loadTodo(todoListId, todoId) {
    const FIND_TODO = "SELECT * FROM todos WHERE todolist_id = $1 AND id = $2";

    let result = await dbQuery(FIND_TODO, todoListId, todoId);
    return result.rows[0];
  }

  // Toggle a todo between the done and not done state. Returns a promise that
  // resolves to `true` on success, `false` if the todo list or todo doesn't
  // exist. The id arguments must both be numeric.
  async toggleDoneTodo(todoListId, todoId) {
    const TOGGLE_DONE = "UPDATE todos SET done = NOT done" +
                        "  WHERE todolist_id = $1 AND id = $2";

    let result = await dbQuery(TOGGLE_DONE, todoListId, todoId);
    return result.rowCount > 0;
  }

  // Delete the specified todo from the specified todo list. 
  // Returns a promise that resolves to `true` on success, `false` on failure.
  // The todoListId  and todoID must be numeric.
  async deleteTodo(todoListId, todoId){
    const DELETE_TODO = "DELETE FROM todos " +
                        "WHERE todolist_id = $1 AND id = $2";

    let result = await dbQuery(DELETE_TODO, todoListId, todoId);
    return result.rowCount > 0;
  }

  // Set all todos in todoList referenced by todoListId to be done. 
  // Returns a promise that resolves to `true` on success, `false` on failure.
  // The todoListId must be numeric.
  async completeAllTodos(todoListId) {
    const MARK_DONE_ALL = "UPDATE todos SET done = TRUE " +
                        "WHERE todolist_id = $1";

    let result = await dbQuery(MARK_DONE_ALL, todoListId);
    return result.rowCount > 0;
  }

  //Add a todo to with todoTitle to todoList with todiListID
  // Returns a promise that resolves to `true` on success, `false` on failure.
  // The todoListId must be numeric.
  async addTodo(todoListId, todoTitle){
    const ADD_TODO = "INSERT INTO todos (todolist_id, title) " +
    "VALUES ($1, $2)";

    let result = await dbQuery(ADD_TODO, todoListId, todoTitle);
    return result.rowCount > 0;
  }

  //Edit a todoList title
  // Returns a promise that resolves to `true` on success, `false` if the todo list doesn't exist. 
  // The id argument must be numeric.
  async setTodoListTitle(todoListId, todoListTitle){
    const SET_TODOLIST_TITLE = "UPDATE todolists SET title = $2 " +
    "WHERE id = $1";

    let result = await dbQuery(SET_TODOLIST_TITLE, todoListId, todoListTitle);
    return result.rowCount > 0;
  }

  // Delete a todoList title
  // Returns a promise that resolves to `true` on success, `false` if the todo list doesn't exist. 
  // The id argument must be numeric.
  async deleteTodoList(todoListId){
    const DELETE_TODOLIST = "DELETE FROM todolists " +
    "WHERE id = $1";

    let result = await dbQuery(DELETE_TODOLIST, todoListId);
    return result.rowCount > 0;
  }

  // Returns promise which resolves to `true` if a todo list with the specified title exists in the list
  // of todo lists, `false` otherwise.
  async existsTodoListTitle(title) {
    const EXISTS_TODOLIST = "SELECT id FROM todolists " +
    "WHERE title = $1";

    let result = await dbQuery(EXISTS_TODOLIST, title);
    return result.rowCount > 0;
  }

  // Create a new todo list with the specified title and add it to the list of
  // todo lists. Returns promise which resoves to `true` on success, `false` on failure. (At this time,
  // there are no known failure conditions.)
  async createTodoList(todoListTitle){
    const ADD_NEW_TODOLIST = "INSERT INTO todolists (title) " +
    "VALUES ($1)";

    let result = await dbQuery(ADD_NEW_TODOLIST, todoListTitle);
    return result.rowCount > 0;
  }
  
  // Returns `true` if `error` seems to indicate a `UNIQUE` constraint
  // violation, `false` otherwise.
  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error));
  }

};