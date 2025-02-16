const NodeHelper = require("node_helper")
const fs = require('fs')
const path = require('path')

module.exports = NodeHelper.create({
  start: function() {
    this.name = 'MMM-MagicDraw'
    this.statePath = path.join(this.path, 'state.json')
    this.saveQueue = []
    this.isSaving = false
    console.log(`${this.name} helper: Started, state file path:`, this.statePath)
  },

  // Add debounced save to handle frequent save requests
  saveState: function(payload) {
    this.saveQueue.push(payload)
    if (!this.isSaving) {
      this.processSaveQueue()
    }
  },

  processSaveQueue: function() {
    if (this.saveQueue.length === 0) {
      this.isSaving = false
      return
    }

    this.isSaving = true
    const latestState = this.saveQueue.pop()
    this.saveQueue = [] // Clear queue since we're using the latest state

    try {
      fs.writeFileSync(this.statePath, JSON.stringify(latestState, null, 2))
      console.log(`${this.name} helper: State saved to file`)
    } catch (error) {
      console.error(`${this.name} helper: Error saving state:`, error)
    }

    // Process next save after a short delay
    setTimeout(() => {
      this.processSaveQueue()
    }, 100)
  },

  socketNotificationReceived: function(notification, payload) {
    if (notification === 'SAVE_STATE') {
      this.saveState(payload)
    }
    else if (notification === 'LOAD_STATE') {
      try {
        if (fs.existsSync(this.statePath)) {
          const data = fs.readFileSync(this.statePath, 'utf8')
          const state = JSON.parse(data)
          this.sendSocketNotification('STATE_LOADED', state)
          console.log(`${this.name} helper: State loaded from file`)
        } else {
          console.log(`${this.name} helper: No saved state file found`)
          this.sendSocketNotification('STATE_LOADED', null)
        }
      } catch (error) {
        console.error(`${this.name} helper: Error loading state:`, error)
        this.sendSocketNotification('STATE_LOADED', null)
      }
    }
  }
})
