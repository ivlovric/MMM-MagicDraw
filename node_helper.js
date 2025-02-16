const NodeHelper = require("node_helper")
const fs = require('fs')
const path = require('path')

module.exports = NodeHelper.create({
  start: function() {
    this.statePath = path.join(this.path, 'state.json')
    console.log('MagicDraw helper started, state file path:', this.statePath)
  },

  socketNotificationReceived: function(notification, payload) {
    if (notification === 'SAVE_STATE') {
      try {
        fs.writeFileSync(this.statePath, JSON.stringify(payload, null, 2))
        console.log('MagicDraw state saved to file')
      } catch (error) {
        console.error('Error saving MagicDraw state:', error)
      }
    }
    else if (notification === 'LOAD_STATE') {
      try {
        if (fs.existsSync(this.statePath)) {
          const data = fs.readFileSync(this.statePath, 'utf8')
          const state = JSON.parse(data)
          this.sendSocketNotification('STATE_LOADED', state)
          console.log('MagicDraw state loaded from file')
        } else {
          console.log('No saved state file found for MagicDraw')
          this.sendSocketNotification('STATE_LOADED', null)
        }
      } catch (error) {
        console.error('Error loading MagicDraw state:', error)
        this.sendSocketNotification('STATE_LOADED', null)
      }
    }
  }
})
