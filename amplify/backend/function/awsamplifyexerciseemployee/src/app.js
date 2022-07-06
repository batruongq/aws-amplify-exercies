/*
Copyright 2017 - 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
*/


/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	DB_HOST
	DB_USER
	DB_PORT
	DB_PASSWORD
	DB_NAME
Amplify Params - DO NOT EDIT */

const express = require('express')
const bodyParser = require('body-parser')
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
const { Client } = require('pg');

// declare a new express app
const app = express()
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())

// Enable CORS for all methods
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "*")
  next()
}); 

const client = new Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
})
try {
  client.connect()
} catch(err) {
  console.log('Database connect', err)
}

/**********************
 * Example get method *
 **********************/

app.get('/employees', async function(req, res) {
  const queryParams = req.query

  let query = `SELECT * from tblEmployees`

  if (queryParams && queryParams.cancelDate) {
    query = `SELECT t1.* 
      FROM tblEmployees t1
      LEFT JOIN tblLunchRegisterStatus t2 on t2.employee_id = t1.id
      LEFT JOIN tblLunchCancelRegister t3 on t3.employee_id = t1.id AND t3.cancelDate = '${queryParams.cancelDate}'
      WHERE t2.status = 'off' OR t3.id IS NOT NULL`;
  }

  try {
    const result = await client.query(query);
    
    res.json({
      rows: result.rows
    })
  } catch(err) {
    res.json(err)
  }

  client.end
});

app.post('/employees', async function(req, res) {
  const user = req.body;
  const query = `INSERT INTO tblEmployees(name) values ('${user.name}')`;

  try {
    await client.query(query)

    res.json({
      message: 'Add employee successfully'
    })
  } catch(err) {
    res.json(err)
  }

  client.end
});

/****************************
* Set cancel lunch for employee *
****************************/
app.post('/employees/:id/cancelLunch', async function(req, res) {
  const {status, cancelDates} = req.body;
  const employeeId = req.params.id;

  const cancelStatus = status === 'off' ? 'off' : 'on';

  const registerStatusQuery = `INSERT INTO tblLunchRegisterStatus(employee_id, status) VALUES
    (${employeeId}, '${cancelStatus}')
    ON CONFLICT (employee_id)
    DO UPDATE SET
      status = EXCLUDED.status`

  try {
    await client.query(registerStatusQuery)
  } catch(err) {
    client.end

    return res.json(err)
  }

  // If employees just cancel some dates, update the cancel dates 
  if (cancelStatus === 'on') {
    
    const valueInsert = cancelDates.map(value =>
      `(${employeeId}, '${value}')`
    )
    const query = `INSERT INTO tblLunchCancelRegister(employee_id, cancelDate) VALUES
      ${valueInsert.join(', ')}`

    try {
      await client.query(query)
    } catch(err) {
      client.end

      return res.json(err)
    }
  }

  res.json({
    message: 'Set cancel lunch successfully'
  })
  
  client.end
});

app.listen(3000, function() {
    console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
