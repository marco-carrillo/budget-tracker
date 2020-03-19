//*****************************************************/
//  Functionality to make the budget application work */
//*****************************************************/
let transactions = [];      // Global variable with the transactions
let myChart;                // Chart with the graph
let db;                     // create a new db request for a "budget" database.
const request = indexedDB.open("budget", 1);  // opens budget
prepareOfflineScenario();   // Preparing local table in case offline

//*****************************************************************************/
//  Getting all transactions from the server, then saves the data on a global */
//  variable and then provides the information to the user 
//*****************************************************************************/
console.log('client requesting first fetch');
fetch("/api/transaction")
  .then(response => {
    console.log('response is ',response);
    return response.json();
  })
  .then(data => {
    // save db data on global variable
    transactions = data;

    //**********************************************************************************/
    //  if online, then displays in UI.  If offline, then it calls a function          */
    //  that checks for any temporary transactions, and if any, then adds to the list  */
    //  of transactions and then displays in UI                                        */
    //**********************************************************************************/

    if (navigator.onLine) {   // If online, nothing to do here.
      populateTotal();    // Adds the list of transactions to the total
      populateTable();    // Adds the list of transaction to the table
      populateChart();    // Adds the list of transactions to the chart
    } else {
      addOfflineItems();
    }
  });

//*********************************************************************************************/
//  This function creates a local table (if it doesn't exist) and sets the proper             */
//  environment so that transactions don't get lost b/c there is no connection to the server  */
//*********************************************************************************************/
function prepareOfflineScenario(){
    
    request.onupgradeneeded = function(event) {
      // create object store called "pending" and set autoIncrement to true
      const db = event.target.result;
      db.createObjectStore("pending", { autoIncrement: true });
    };
    
    request.onsuccess = function(event) {
      db = event.target.result;
    
      //*******************************************************************************************/
      // check if app is online before reading from db.  If it is, will send all stored data to   */
      // permanent storage.  If it is off-line, it will check whether there are temporary records */
      // If there are, that means they were created last session and need to be added to the      */
      // transactions stored in permanent storage (which are displayed).                          */ 
      //*******************************************************************************************/
      if (navigator.onLine) {
        checkDatabase();
      }
    };
    
    request.onerror = function(event) {
      console.log("Woops! " + event.target.errorCode);
    };
}

//***************************************************************************/
//  Following function gets all of the records from the index db and then   */
//  sends them to the server.  This function is called only after verifying */
//  that there is connectivity.                                             */
//***************************************************************************/
function checkDatabase() {
  const transaction = db.transaction(["pending"], "readwrite"); // open a transaction on your pending db
  const store = transaction.objectStore("pending");             // access your pending object store
  const getAll = store.getAll();                                // get all records from store and set to a variable

  getAll.onsuccess = function() {
    if (getAll.result.length > 0) {
      fetch("/api/transaction/bulk", {
        method: "POST",
        body: JSON.stringify(getAll.result),
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json"
        }
      })
      .then(response => response.json())
      .then(() => {
        const transaction = db.transaction(["pending"], "readwrite");  // if successful, open a transaction on your pending db
        const store = transaction.objectStore("pending");              // access your pending object store
        store.clear();                                                 // clear all items in your store
      });
    }
  };
}

//******************************************************************************/
//  Following function checks if system is offline.  If it is, then searches   */
//  for any transaction in indexedDB table and pushes it to the cached         */
//  list of transactions so that they are included.                            */
//******************************************************************************/
function addOfflineItems() {

  const transaction = db.transaction(["pending"], "readwrite"); // open a transaction on your pending db
  const store = transaction.objectStore("pending");             // access your pending object store
  const getAll = store.getAll();                                // get all records from store and set to a variable

  getAll.onsuccess = function() {
    if (getAll.result.length > 0) {
        getAll.result.forEach(temp=>{
            transactions.unshift(temp);
        })
    }
    populateTotal();    // Adds the list of transactions to the total
    populateTable();    // Adds the list of transaction to the table
    populateChart();    // Adds the list of transactions to the chart

  };
}

//**********************************************************************/
//  This function calculates the balance and updates it on the screen  */
//**********************************************************************/
  function populateTotal() {
  // reduce transaction amounts to a single total value
  let total = transactions.reduce((total, t) => {
    return total + parseInt(t.value);
  }, 0);

  let totalEl = document.querySelector("#total");
  totalEl.textContent = total;
}

//**************************************************************************************/
//  This function takes data from the input boxes and appends an element to the table  */
//**************************************************************************************/
function populateTable() {
  let tbody = document.querySelector("#tbody");
  tbody.innerHTML = "";

  transactions.forEach(transaction => {
    // create and populate a table row
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;

    tbody.appendChild(tr);
  });
}

//***************************************************************************/
//  This function takes the total transactions, and displays it on a graph  */
//***************************************************************************/
function populateChart() {
  // copy array and reverse it
  let reversed = transactions.slice().reverse();
  let sum = 0;

  // create date labels for chart
  let labels = reversed.map(t => {
    let date = new Date(t.date);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  });

  // create incremental values for chart
  let data = reversed.map(t => {
    sum += parseInt(t.value);
    return sum;
  });

  // remove old chart if it exists
  if (myChart) {
    myChart.destroy();
  }

  let ctx = document.getElementById("myChart").getContext("2d");

  myChart = new Chart(ctx, {
    type: 'line',
      data: {
        labels,
        datasets: [{
            label: "Total Over Time",
            fill: true,
            backgroundColor: "#6666ff",
            data
        }]
    }
  });
}

//*****************************************************************************/
//  This function takes a new transaction entered by the user, creates a new  */
//  data element, refreshes the screen (totals, graph, etc.) and then sends   */
//  a POST transaction to the server to add this information to the database  */
//*****************************************************************************/
function sendTransaction(isAdding) {
  let nameEl = document.querySelector("#t-name");
  let amountEl = document.querySelector("#t-amount");
  let errorEl = document.querySelector(".form .error");

  // validate form
  if (nameEl.value === "" || amountEl.value === "") {
    errorEl.textContent = "Missing Information";
    return;
  }
  else {
    errorEl.textContent = "";
  }

  // create record
  let transaction = {
    name: nameEl.value,
    value: amountEl.value,
    date: new Date().toISOString()
  };

  // if subtracting funds, convert amount to negative number
  if (!isAdding) {
    transaction.value *= -1;
  }

  // add to beginning of current array of data
  transactions.unshift(transaction);

  // re-run logic to populate ui with new record
  populateChart();
  populateTable();
  populateTotal();
  
  // also send to server
  fetch("/api/transaction", {
    method: "POST",
    body: JSON.stringify(transaction),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json"
    }
  })
  .then(response => {    
    return response.json();
  })
  .then(data => {
    if (data.errors) {
      errorEl.textContent = "Missing Information";
    }
    else {
      // clear form
      nameEl.value = "";
      amountEl.value = "";
    }
  })
  .catch(err => {
    // fetch failed, so save in indexed db
    saveRecord(transaction);

    // clear form
    nameEl.value = "";
    amountEl.value = "";
  });
}

//******************************************************************************/
//  The following function will be called to add a transaction to the indexed  */
//  database.  This will happen when the POST API call fails (offline)         */
//******************************************************************************/
function saveRecord(record) {
  // create a transaction on the pending db with readwrite access
  const transaction = db.transaction(["pending"], "readwrite");

  // access your pending object store
  const store = transaction.objectStore("pending");

  // add record to your store with add method.
  store.add(record);
}

//*****************************************************************************/
//  When the user clicks either the add funds or substract funds, that data   */
//  will be sent to the server for permanent storage in databse.              */
//*****************************************************************************/
document.querySelector("#add-btn").onclick = function() {
  sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function() {
  sendTransaction(false);
};

// listen for app coming back online
window.addEventListener("online", checkDatabase);
