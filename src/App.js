import {Component, Fragment} from "react"
import $ from "jquery"
import axios from "axios"
import {Sigma, RandomizeNodePositions /*, NOverlap*/} from "react-sigma"
import ForceAtlas2 from "react-sigma/lib/ForceAtlas2"
import CommitLegend from "./assets/commitlegend.png"
import StarLegend from "./assets/starlegend.png"

const DEFAULT_NAMES = ["obaseki1", "jordems", "n-a-t-e-w", "nicholas-c-brown", "devon-macneil", "kranslam"]
const MAX_NAMES = 7

axios.defaults.baseURL = "http://localhost:5000/cosc329-project/us-central1/api"
//axios.defaults.baseURL = "https://us-central1-cosc329-project.cloudfunctions.net/api"

class App extends Component {
  state = {
    names: [],
    disabled: false,
    nodes: [],
    edges: [],
    loading: null,
    errors: [],
    align: {className: "container"}
  }

  repos = null
  legend = null

  addName = e => {
    e.preventDefault()
    let name = $("#nameInput").val(),
      {names} = this.state
    if (name.toString().trim().length > 0 && !names.includes(name)) {
      this.setState({names: [...names, name]})
      if (names.length === MAX_NAMES - 1) {
        $("#nameInput").prop("disabled", true)
        $("#addUser").prop("disabled", true)
      }
    }
    $("#nameInput").val("")
  }

  checkDefault = () => {
    let disabled = !$("#nameInput").prop("disabled")
    $("#nameInput").prop("disabled", disabled)
    $("#addUser").prop("disabled", disabled)
    this.setState({names: disabled ? DEFAULT_NAMES : [], disabled})
  }

  componentDidMount() {
    $("#commits").prop("checked", true)
    this.setState({align: this.isMobile() ? {align: "center"} : {className: "container"}})
  }

  getCommits = (repos, commits) => {
    this.setState({loading: "Getting commits"})
    return Promise.all(
      repos.map(repo => {
        return new Promise(async (resolve, reject) => {
          try {
            let {data} = await axios.get(`/commits/${repo.commits_url.split("/").slice(4, 6).join("/")}`)
            if (data.limit) return reject(this.setState({errors: [data.error]}))
            if (!data.error) commits.push(...data)
            resolve()
          } catch (err) {
            console.error(err)
            this.setState({
              errors: [...this.state.errors, `Error getting commits for ${repo.name}`]
            })
            reject()
          }
        })
      })
    )
  }

  getData = () => {
    this.setState({
      nodes: [],
      edges: [],
      loading: "Getting repos",
      errors: []
    })
    if (this.state.names.length < 2) return this.setState({errors: ["Add at least 2 users first"], loading: null})
    if (this.state.names.length > MAX_NAMES) return this.setState({errors: [`Please do not search for more than ${MAX_NAMES} users`], loading: null})
    let {names} = this.state
    let repos = [],
      commits = [],
      stars = []
    this.getRepos(names, repos)
      .then(() => {
        if ($("#commits").prop("checked")) {
          return this.getCommits(repos, commits)
        } else {
          return this.getStars(repos, stars)
        }
      })
      .then(() => {
        this.repos = repos
        if ($("#commits").prop("checked")) {
          return this.graphCommits(names, repos, commits)
        } else {
          return this.graphStars(names, repos, stars)
        }
      })
      .catch(err => {
        console.error(err)
        this.setState({loading: null})
      })
  }

  getRepos = (names, repos) => {
    return Promise.all(
      names.map(name => {
        return new Promise(async (resolve, reject) => {
          try {
            let {data} = await axios.get(`/repos/${name}`)
            if (data.limit) return reject(this.setState({errors: [data.error]}))
            repos.push(...data.filter(repo => !repo.fork))
            resolve()
          } catch (err) {
            console.error(err)
            this.setState({
              errors: [...this.state.errors, `Error getting repos for ${name}`]
            })
            reject()
          }
        })
      })
    )
  }

  getStars = (repos, stars) => {
    this.setState({loading: "Getting stars"})
    return Promise.all(
      repos.map(repo => {
        return new Promise(async (resolve, reject) => {
          try {
            let {data} = await axios.get(`/stars/${repo.commits_url.split("/").slice(4, 6).join("/")}`)
            if (data.limit) return reject(this.setState({errors: [data.error]}))
            if (!data.error) stars.push(...data)
            resolve()
          } catch (err) {
            console.error(err)
            this.setState({
              errors: [...this.state.errors, `Error getting stars for ${repo.name}`]
            })
            reject()
          }
        })
      })
    )
  }

  graphCommits = (names, repos, commits) => {
    this.setState({loading: "Creating the graph"})
    this.legend = CommitLegend
    let nodes = [],
      edges = []
    names.forEach(name => nodes.push({id: name, label: name, size: 6, color: "#0000ff"}))
    repos
      .filter(repo => !repo.fork)
      .forEach(repo => {
        nodes.push({id: repo.name, label: repo.name, size: 3, color: "#000000"})
        names.forEach(name => {
          let nameCommits = commits.filter(commit => commit.commit.url.split("/")[5] === repo.name && commit?.author?.login.toLowerCase() === name.toLowerCase()).length
          let repoCommits = commits.filter(({commit}) => commit.url.split("/")[5] === repo.name).length
          let numCommits = (nameCommits / repoCommits) * 4
          if (repo.owner.login === name) numCommits += 1
          if (numCommits > 0) {
            edges.push({id: name + repo.name, source: name, target: repo.name, size: numCommits, color: repo.owner.login.toLowerCase() === name.toLowerCase() ? "#ff0000" : "#000000"})
          }
        })
      })
    this.setState({
      nodes,
      edges,
      loading: null
    })
  }

  graphStars = (names, repos, stars) => {
    this.setState({loading: "Creating the graph"})
    this.legend = StarLegend
    let nodes = [],
      edges = []
    names.forEach(name => nodes.push({id: name, label: name, size: 6, color: "#0000ff"}))
    repos
      .filter(repo => !repo.fork)
      .forEach(repo => {
        nodes.push({id: repo.name, label: repo.name, size: 3, color: "#000000"})
        names.forEach(name => {
          let nameStars = stars.filter(star => star.repo === repo.name && star.login.toLowerCase() === name.toLowerCase()).length
          let repoStars = stars.filter(star => star.repo === repo.name).length
          let numStars = (nameStars / repoStars) * 4
          if (nameStars > 0) {
            edges.push({id: name + repo.name, source: name, target: repo.name, size: repo.owner.login.toLowerCase() === name.toLowerCase() ? numStars + 1 : numStars, color: repo.owner.login.toLowerCase() === name.toLowerCase() ? "#ff0000" : "#000000"})
          } else if (repo.owner.login.toLowerCase() === name.toLowerCase() && repoStars > 0) {
            edges.push({id: name + repo.name, source: name, target: repo.name, size: numStars + 1, color: "#00ff00"})
          }
        })
      })
    this.setState({
      nodes,
      edges,
      loading: null
    })
  }

  isMobile = () => {
    let a = navigator.userAgent || navigator.vendor || window.opera || ""
    return (
      /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) ||
      /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw-(n|u)|c55\/|capi|ccwa|cdm-|cell|chtm|cldc|cmd-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc-s|devi|dica|dmob|do(c|p)o|ds(12|-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(-|_)|g1 u|g560|gene|gf-5|g-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd-(m|p|t)|hei-|hi(pt|ta)|hp( i|ip)|hs-c|ht(c(-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i-(20|go|ma)|i230|iac( |-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|-[a-w])|libw|lynx|m1-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|-([1-8]|c))|phil|pire|pl(ay|uc)|pn-2|po(ck|rt|se)|prox|psio|pt-g|qa-a|qc(07|12|21|32|60|-[2-7]|i-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h-|oo|p-)|sdk\/|se(c(-|0|1)|47|mc|nd|ri)|sgh-|shar|sie(-|m)|sk-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h-|v-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl-|tdg-|tel(i|m)|tim-|t-mo|to(pl|sh)|ts(70|m-|m3|m5)|tx-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas-|your|zeto|zte-/i.test(
        a.substr(0, 4)
      )
    )
  }

  removeName = name => {
    if (this.state.names.length === MAX_NAMES) {
      $("#nameInput").prop("disabled", false)
      $("#addUser").prop("disabled", false)
    }
    if (!this.state.disabled) {
      this.setState({names: [...this.state.names.filter(n => n !== name)]})
    }
  }

  render() {
    let graph =
      this.state.nodes.length > 0 && this.state.edges.length > 0 ? (
        <Fragment>
          <div id="graph" style={{width: "inherit", height: "550px", border: "2px solid black"}}>
            <img src={this.legend} style={{float: "right"}} height={546} alt="legend" />
            <Sigma renderer="webgl" style={{maxWidth: "inherit", height: "546px"}} settings={{drawEdges: true, minEdgeSize: 1, maxEdgeSize: 5, minNodeSize: 3, maxNodeSize: 6}} graph={{nodes: this.state.nodes, edges: this.state.edges}}>
              <RandomizeNodePositions>
                {/*<NOverlap /> causing clustering to break sometimes?*/}
                <ForceAtlas2 />
              </RandomizeNodePositions>
            </Sigma>
          </div>
          <hr />
          <h2>Repositories:</h2>
          <div style={{height: 550, overflowY: "scroll"}}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Author</th>
                  <th scope="col">Size</th>
                  <th scope="col">Stars</th>
                  <th scope="col">Forks</th>
                  <th scope="col">Date Created</th>
                </tr>
              </thead>
              <tbody>
                {this.repos
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .map((repo, idx) => {
                    return (
                      <tr key={idx}>
                        <th scope="row">{repo.name}</th>
                        <td>{repo.owner.login}</td>
                        <td>{repo.size}</td>
                        <td>{repo.stargazers_count}</td>
                        <td>{repo.forks_count}</td>
                        <td>{repo.created_at.substring(0, 10)}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </Fragment>
      ) : null
    return (
      <div {...this.state.align} style={{marginTop: 15, marginBottom: 15}}>
        <h1>Github Collaboration Calculator</h1>
        <hr />
        <form onSubmit={this.addName}>
          <div className="form-check">
            <input type="checkbox" id="defaultCheck" className="form-check-input" onClick={this.checkDefault} />
            <label htmlFor="defaultCheck">Use default list</label>
          </div>
          <div className="form-group">
            <input type="text" id="nameInput" className="form-control-md" size="25" autoComplete="off" placeholder="Enter a Github Username" />
          </div>
          <button className="btn btn-primary" type="submit" id="addUser">
            Add Username
          </button>
        </form>
        <hr />
        <div style={{height: 150, width: 300, outline: "1px solid black", backgroundColor: "#e5e5e5", overflowY: "scroll", overflowX: "hidden"}}>
          {this.state.names.map((name, idx) => {
            return (
              <div key={idx}>
                <small>{name}</small>
                {!this.state.disabled && (
                  <button className="btn" type="button" onClick={() => this.removeName(name)}>
                    X
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div className="form-check form-check-inline">
          <input className="form-check-input" type="radio" name="radio" id="commits" value="option1" />
          <label className="form-check-label" htmlFor="commits">
            Commits
          </label>
        </div>
        <div className="form-check form-check-inline">
          <input className="form-check-input" type="radio" name="radio" id="stars" value="option2" />
          <label className="form-check-label" htmlFor="stars">
            Stars
          </label>
        </div>
        <br />
        <button className="btn btn-primary" onClick={this.getData} type="button">
          Calculate
        </button>
        <hr />

        {this.state.loading && (
          <div style={{textAlign: "center"}}>
            <h3>{this.state.loading}</h3>
            <small>this may take a minute</small>
          </div>
        )}
        {this.state.errors.map(err => {
          return <h4 className="text-danger">{err}</h4>
        })}
        {graph}
      </div>
    )
  }
}

export default App
