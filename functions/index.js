const functions = require("firebase-functions")
const cors = require("cors")
const express = require("express")
const app = express()
const axios = require("axios")
const token = functions.config().token.token

app.use(cors())

const header = {headers: {Authorization: "token " + token}}
//const header = {}

const handleError = (res, err) => {
  console.error(err)
  if (err?.response?.status === 409) return res.json({error: "Empty repo"})
  else if (err?.response?.status === 403) return res.json({error: "Request limit reached, please try again later.", limit: true})
  else return res.status(500).json(err)
}

app.get("/repos/:user", (req, res) => {
  let {user} = req.params
  axios
    .get(`https://api.github.com/users/${user}/repos`, header)
    .then(({data}) => {
      return res.json(data.filter(repo => !repo.fork).slice(0, 10))
    })
    .catch(err => handleError(res, err))
})

app.get("/commits/:user/:repo", (req, res) => {
  let {user, repo} = req.params
  axios
    .get(`https://api.github.com/repos/${user}/${repo}/commits`, header)
    .then(({data}) => {
      return res.json(data)
    })
    .catch(err => handleError(res, err))
})

app.get("/stars/:user/:repo", (req, res) => {
  let {user, repo} = req.params
  axios
    .get(`https://api.github.com/repos/${user}/${repo}/stargazers`, header)
    .then(({data}) => {
      data.forEach(star => {
        star.repo = repo
      })
      return res.json(data)
    })
    .catch(err => handleError(res, err))
})

exports.api = functions.https.onRequest(app)
