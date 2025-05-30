
declare module '*.worker.js' { // Or specific path if preferred, e.g. '*/mcts-worker.js'
  class WebpackWorker extends Worker {
    constructor();
  }
  export default WebpackWorker;
}
