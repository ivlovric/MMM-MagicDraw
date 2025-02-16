Module.register("MMM-MagicDraw", {

  defaults: {
    backgroundColor: "#f5f5f5",
    currentShape: 'freehand',
    fontSize: 20,
    textColor: '#000000',
    labelBackgroundColor: '#633333',
    pointerDirection: 'down',
    storageKey: 'MMM-MagicDraw-state',  // Key for localStorage
    currentColor: '#000000',  // Add default current color
    fillColor: '#ffffff'  // Default fill color
  },

  /**
   * Apply the default styles.
   */
  getStyles() {
    return ["template.css", "https://unpkg.com/konva@9.3.3/konva.min.js"]
  },

  /**
   * Pseudo-constructor for our module. Initialize stuff here.
   */
  start() {
    this.log('Starting module')
    this.stage = null
    this.layer = null
    this.isDrawing = false
    this.lastLine = null
    this.currentShape = null
    this.startPos = null
    this.history = []
    this.updateDimensions = this.updateDimensions.bind(this)
    this.saveCanvasState = this.saveCanvasState.bind(this)
    
    window.addEventListener('resize', this.updateDimensions)
    window.addEventListener('beforeunload', this.saveCanvasState)
  },

  /**
   * Handle notifications received by the node helper.
   * So we can communicate between the node helper and the module.
   *
   * @param {string} notification - The notification identifier.
   * @param {any} payload - The payload data`returned by the node helper.
   */
  socketNotificationReceived: function (notification, payload) {
    if (notification === "EXAMPLE_NOTIFICATION") {
      this.templateContent = `${this.config.exampleContent} ${payload.text}`
      this.updateDom()
    } else if (notification === 'STATE_LOADED') {
      this.log('Received saved state')
      if (payload && this.layer) {
        try {
          // Clear existing state
          while(this.history.length > 0) {
            const shape = this.history.pop()
            shape.destroy()
          }
          this.layer.destroyChildren()
          this.layer.clear()
          
          // Track loaded shape IDs to prevent duplicates
          const loadedShapeIds = new Set()
          
          payload.shapes.forEach(shapeData => {
            // Skip if we've already loaded this shape
            if (loadedShapeIds.has(shapeData.id)) {
              this.log(`Skipping duplicate shape with ID: ${shapeData.id}`)
              return
            }
            
            let shape
            
            if (shapeData.className === 'Label') {
              shape = new Konva.Label({
                x: shapeData.attrs.x,
                y: shapeData.attrs.y,
                draggable: true
              })

              shapeData.children.forEach(childData => {
                let child
                if (childData.className === 'Tag') {
                  child = new Konva.Tag(childData.attrs)
                } else if (childData.className === 'Text') {
                  child = new Konva.Text(childData.attrs)
                }
                if (child) {
                  shape.add(child)
                }
              })
            } else {
              const ShapeClass = Konva[shapeData.className]
              if (ShapeClass) {
                shape = new ShapeClass(shapeData.attrs)
                if (shapeData.className === 'Text') {
                  shape.draggable(true)
                }
              }
            }

            if (shape) {
              shape._id = shapeData.id // Store the ID
              this.layer.add(shape)
              this.history.push(shape)
              loadedShapeIds.add(shapeData.id)
            }
          })
          
          this.layer.batchDraw()
          this.log(`Restored canvas state with ${this.history.length} shapes`)
        } catch (error) {
          this.logError(`Error restoring canvas state: ${error.toString()}`)
        }
      }
    }
  },

  /**
   * Render the page we're on.
   */
  getDom() {
    this.log("Creating DOM elements")
    const wrapper = document.createElement("div")
    wrapper.id = "drawing-container"
    
    const controls = document.createElement("div")
    controls.id = "shape-controls"
    
    // Add label for fill color
    const fillColorLabel = document.createElement("label")
    fillColorLabel.innerHTML = "Fill Color:"
    controls.appendChild(fillColorLabel)

    // Add fill color picker
    const fillColorPicker = document.createElement("input")
    fillColorPicker.type = "color"
    fillColorPicker.id = "fill-color-picker"
    fillColorPicker.value = this.config.fillColor || '#ffffff'  // Default fill color
    fillColorPicker.addEventListener('change', (e) => {
      this.config.fillColor = e.target.value
      this.log(`Fill color changed to: ${this.config.fillColor}`)
    })
    controls.appendChild(fillColorPicker)

    // Add label for stroke color
    const strokeColorLabel = document.createElement("label")
    strokeColorLabel.innerHTML = "Stroke Color:"
    controls.appendChild(strokeColorLabel)

    // Add stroke color picker
    const strokeColorPicker = document.createElement("input")
    strokeColorPicker.type = "color"
    strokeColorPicker.id = "stroke-color-picker"
    strokeColorPicker.value = this.config.currentColor || '#000000'  // Default stroke color
    strokeColorPicker.addEventListener('change', (e) => {
      this.config.currentColor = e.target.value
      this.log(`Stroke color changed to: ${this.config.currentColor}`)
    })
    controls.appendChild(strokeColorPicker)

    // Add label for arrow direction
    const arrowDirectionLabel = document.createElement("label")
    arrowDirectionLabel.innerHTML = "Arrow Direction:"
    controls.appendChild(arrowDirectionLabel)

    // Add arrow direction options
    const arrowDirectionSelect = document.createElement("select")
    arrowDirectionSelect.id = "arrow-direction-selector"
    const directions = ['up', 'down', 'left', 'right']
    directions.forEach(direction => {
      const option = document.createElement("option")
      option.value = direction
      option.text = direction.charAt(0).toUpperCase() + direction.slice(1)
      arrowDirectionSelect.appendChild(option)
    })
    arrowDirectionSelect.addEventListener('change', (e) => {
      this.config.pointerDirection = e.target.value
      this.log(`Arrow direction changed to: ${this.config.pointerDirection}`)
    })
    controls.appendChild(arrowDirectionSelect)

    // Add shape selector
    const shapeSelector = document.createElement("select")
    shapeSelector.id = "shape-selector"
    const shapes = ['select', 'freehand', 'rectangle', 'circle', 'line', 'text', 'label', 'star', 'ring']
    shapes.forEach(shape => {
      const option = document.createElement("option")
      option.value = shape
      option.text = shape.charAt(0).toUpperCase() + shape.slice(1)
      shapeSelector.appendChild(option)
    })
    
    shapeSelector.addEventListener('change', (e) => {
      this.config.currentShape = e.target.value
      if (e.target.value === 'select') {
        this.stage.container().style.cursor = 'pointer';  // Change cursor for selection
      } else {
        this.stage.container().style.cursor = 'crosshair';  // Change cursor for drawing
      }
    })

    controls.appendChild(shapeSelector)
    
    // Create keyboard container
    const keyboardContainer = document.createElement("div")
    keyboardContainer.id = "keyboard-container"
    keyboardContainer.style.display = "none"
    this.log("Keyboard container created and hidden by default")
    
    const rows = [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
      ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.']
    ]
    
    rows.forEach(row => {
      const keyboardRow = document.createElement("div")
      keyboardRow.className = "keyboard-row"
      
      row.forEach(key => {
        const keyButton = document.createElement("button")
        keyButton.className = "keyboard-key"
        keyButton.textContent = key
        keyButton.addEventListener('click', (e) => {
          e.preventDefault()
          textInput.value += key
          this.log(`Key pressed: ${key}, current text: ${textInput.value}`)
        })
        keyboardRow.appendChild(keyButton)
      })
      
      keyboardContainer.appendChild(keyboardRow)
    })
    
    // Add special keys row
    const specialRow = document.createElement("div")
    specialRow.className = "keyboard-row"
    
    // Space key
    const spaceKey = document.createElement("button")
    spaceKey.className = "keyboard-key space-key"
    spaceKey.textContent = "Space"
    spaceKey.addEventListener('click', (e) => {
      e.preventDefault()
      textInput.value += ' '
      this.log("Space key pressed")
    })
    
    // Backspace key
    const backspaceKey = document.createElement("button")
    backspaceKey.className = "keyboard-key backspace-key"
    backspaceKey.textContent = "⌫"
    backspaceKey.addEventListener('click', (e) => {
      e.preventDefault()
      textInput.value = textInput.value.slice(0, -1)
      this.log(`Backspace pressed, new text: ${textInput.value}`)
    })
    
    // Done key
    const doneKey = document.createElement("button")
    doneKey.className = "keyboard-key done-key"
    doneKey.textContent = "Done"
    doneKey.addEventListener('click', (e) => {
      e.preventDefault()
      keyboardContainer.style.display = "none"
      this.log("Done pressed - keyboard hidden")
    })
    
    specialRow.appendChild(spaceKey)
    specialRow.appendChild(backspaceKey)
    specialRow.appendChild(doneKey)
    keyboardContainer.appendChild(specialRow)
    
    // Add text input
    const textInput = document.createElement("input")
    textInput.type = "text"
    textInput.id = "text-input"
    textInput.placeholder = "Enter text..."
    
    // Add font size input
    const fontSizeInput = document.createElement("input")
    fontSizeInput.type = "number"
    fontSizeInput.id = "font-size-input"
    fontSizeInput.value = this.config.fontSize
    fontSizeInput.min = "8"
    fontSizeInput.max = "72"
    
    fontSizeInput.addEventListener('change', (e) => {
      this.config.fontSize = parseInt(e.target.value)
    })
    
    // Add undo button
    const undoButton = document.createElement("button")
    undoButton.id = "undo-button"
    undoButton.innerHTML = "Undo"
    undoButton.addEventListener('click', () => this.undo())
    
    // Add clear all button with confirmation
    const clearButton = document.createElement("button")
    clearButton.id = "clear-button"
    clearButton.innerHTML = "Clear All"
    clearButton.addEventListener('click', () => {
      // Create confirmation dialog
      const confirmDialog = document.createElement("div")
      confirmDialog.id = "confirm-dialog"
      confirmDialog.innerHTML = `
        <div class="confirm-content">
          <p>Are you sure you want to clear all drawings?</p>
          <div class="confirm-buttons">
            <button id="confirm-yes">Yes</button>
            <button id="confirm-no">No</button>
          </div>
        </div>
      `
      
      // Add dialog to wrapper
      wrapper.appendChild(confirmDialog)
      
      // Show dialog with fade in
      setTimeout(() => {
        confirmDialog.classList.add('visible')
      }, 10)
      
      // Handle confirmation buttons
      document.getElementById('confirm-yes').addEventListener('click', () => {
        this.clearAll()  // Call the clearAll method
        confirmDialog.classList.remove('visible')
        setTimeout(() => {
          confirmDialog.remove()
        }, 300)
        this.log('Clear all confirmed and executed')
      })
      
      document.getElementById('confirm-no').addEventListener('click', () => {
        confirmDialog.classList.remove('visible')
        setTimeout(() => {
          confirmDialog.remove()
        }, 300)
        this.log('Clear all cancelled')
      })
      
      // Close on outside click
      confirmDialog.addEventListener('click', (e) => {
        if (e.target === confirmDialog) {
          confirmDialog.classList.remove('visible')
          setTimeout(() => {
            confirmDialog.remove()
          }, 300)
          this.log('Clear all cancelled by outside click')
        }
      })
    })
    
    // Add all controls to the container in correct order
    controls.appendChild(undoButton)
    controls.appendChild(clearButton)
    controls.appendChild(textInput)
    controls.appendChild(fontSizeInput)
    
    // Create container for Konva stage
    const container = document.createElement("div")
    container.id = "konva-container"
    
    // Add everything to wrapper in correct order
    wrapper.appendChild(controls)
    wrapper.appendChild(keyboardContainer)
    wrapper.appendChild(container)
    
    // Prevent default keyboard from showing on mobile
    textInput.addEventListener('focus', (e) => {
      e.preventDefault()
      textInput.blur()
      keyboardContainer.style.display = "block"
      this.log("Text input focused - showing keyboard and preventing default")
    })
    
    // Close keyboard when clicking outside
    document.addEventListener('click', (e) => {
      if (!keyboardContainer.contains(e.target) && 
          e.target !== textInput && 
          keyboardContainer.style.display === "block") {
        keyboardContainer.style.display = "none"
        this.log("Outside click detected - hiding keyboard")
      }
    })

    // Initialize Konva after DOM element is created
    setTimeout(() => {
      if (!this.stage) {
        this.initKonva()
        this.updateDimensions()
      }
    }, 100)

    this.log("DOM creation complete")
    return wrapper
  },

  initKonva() {
    this.log('Initializing Konva stage')
    this.stage = new Konva.Stage({
      container: 'konva-container',
      width: 100,
      height: 100
    })

    // Create background layer
    this.backgroundLayer = new Konva.Layer()
    this.layer = new Konva.Layer()
    
    // Add layers in correct order
    this.stage.add(this.backgroundLayer)
    this.stage.add(this.layer)

    // Set the background color with slight transparency
    const background = new Konva.Rect({
      x: 0,
      y: 0,
      width: this.stage.width(),
      height: this.stage.height(),
      fill: '#f7e8d0',
      opacity: 0.5
    })

    this.backgroundLayer.add(background)
    this.backgroundLayer.draw()

    // Update background size when stage resizes
    this.stage.on('resize', () => {
      background.width(this.stage.width())
      background.height(this.stage.height())
      this.backgroundLayer.draw()
    })

    this.stage.on('mousedown touchstart', () => {
      if (this.config.currentShape === 'select') {
        return
      }

      this.isDrawing = true
      this.startPos = this.stage.getPointerPosition()

      switch(this.config.currentShape) {
        case 'freehand':
          this.lastLine = new Konva.Line({
            stroke: this.config.currentColor,  // Use current color
            strokeWidth: 2,
            points: [this.startPos.x, this.startPos.y, this.startPos.x, this.startPos.y],
            lineCap: 'round',
            lineJoin: 'round'
          })
          this.currentShape = this.lastLine
          break;
          
        case 'rectangle':
          this.currentShape = new Konva.Rect({
            x: this.startPos.x,
            y: this.startPos.y,
            width: 0,
            height: 0,
            stroke: this.config.currentColor,  // Use current color
            strokeWidth: 2
          })
          break;
          
        case 'circle':
          this.currentShape = new Konva.Circle({
            x: this.startPos.x,
            y: this.startPos.y,
            radius: 0,
            stroke: this.config.currentColor,  // Use current color
            strokeWidth: 2
          })
          break;
          
        case 'line':
          this.currentShape = new Konva.Line({
            points: [this.startPos.x, this.startPos.y, this.startPos.x, this.startPos.y],
            stroke: this.config.currentColor,  // Use current color
            strokeWidth: 2,
            lineCap: 'round',
            lineJoin: 'round'
          })
          break;
          
        case 'text':
          const textInput = document.getElementById('text-input')
          const text = textInput.value.trim()
          if (text) {
            this.currentShape = new Konva.Text({
              x: this.startPos.x,
              y: this.startPos.y,
              text: text,
              fontSize: this.config.fontSize,
              fill: this.config.currentColor,  // Use current color
              draggable: true
            })
            this.layer.add(this.currentShape)
            this.layer.batchDraw()
            this.history.push(this.currentShape)
            this.saveCanvasState()
            this.log('Text added and state saved')
            
            textInput.value = ''
          }
          this.isDrawing = false
          break
        
        case 'label':
          const textInputLabel = document.getElementById('text-input')
          const textLabel = textInputLabel.value.trim()
          if (textLabel) {
            // Create a label with background
            const label = new Konva.Label({
              x: this.startPos.x,
              y: this.startPos.y,
              draggable: true
            });

            // Add background
            label.add(new Konva.Tag({
              fill: this.config.currentColor,  // Use current color
              lineJoin: 'round',
              pointerDirection: this.config.pointerDirection,
              pointerWidth: 20,
              pointerHeight: 20,
              shadowColor: 'black',
              shadowBlur: 10,
              shadowOffsetX: 5,
              shadowOffsetY: 5,
              shadowOpacity: 0.3,
              cornerRadius: 5
            }));

            // Add text
            label.add(new Konva.Text({
              text: textLabel,
              fontFamily: 'Calibri',
              fontSize: this.config.fontSize,
              padding: 5,
              fill: '#ffffff',  // Keep text white for contrast
            }));

            this.layer.add(label)
            this.layer.batchDraw()
            this.history.push(label)
            this.saveCanvasState()
            this.log('Label added and state saved')
            
            textInputLabel.value = ''
          }
          this.isDrawing = false
          break;
        
        case 'star':
          this.currentShape = new Konva.Star({
            x: this.startPos.x,
            y: this.startPos.y,
            numPoints: 5,
            innerRadius: 0,
            outerRadius: 0,
            stroke: this.config.currentColor,
            fill: this.config.fillColor,  // Use fill color
            strokeWidth: 2,
            draggable: true
          })
          break
          
        case 'ring':
          this.currentShape = new Konva.Ring({
            x: this.startPos.x,
            y: this.startPos.y,
            innerRadius: 0,
            outerRadius: 0,
            stroke: this.config.currentColor,
            fill: this.config.fillColor,  // Use fill color
            strokeWidth: 2,
            draggable: true
          })
          break
      }
      
      if (this.currentShape && !['text', 'label'].includes(this.config.currentShape)) {
        this.layer.add(this.currentShape)
        
        // Add click handler for selection
        this.currentShape.on('click tap', (e) => {
          e.cancelBubble = true
          this.selectShape(this.currentShape)
        })
      }
    })

    this.stage.on('mousemove touchmove', (e) => {
      if (!this.isDrawing) {
        return
      }

      const pos = this.stage.getPointerPosition()
      
      switch(this.config.currentShape) {
        case 'freehand':
          const points = this.lastLine.points()
          points.push(pos.x)
          points.push(pos.y)
          this.lastLine.points(points)
          break;
          
        case 'rectangle':
          this.currentShape.width(pos.x - this.startPos.x)
          this.currentShape.height(pos.y - this.startPos.y)
          break;
          
        case 'circle':
          const dx = pos.x - this.startPos.x
          const dy = pos.y - this.startPos.y
          const radius = Math.sqrt(dx * dx + dy * dy)
          this.currentShape.radius(radius)
          break;
          
        case 'line':
          this.currentShape.points([this.startPos.x, this.startPos.y, pos.x, pos.y])
          break;
          
        case 'text':
          // Text doesn't need mousemove handling
          break
        
        case 'star':
          const starRadius = Math.sqrt(
            Math.pow(pos.x - this.startPos.x, 2) +
            Math.pow(pos.y - this.startPos.y, 2)
          )
          this.currentShape.innerRadius(starRadius * 0.5)
          this.currentShape.outerRadius(starRadius)
          break
          
        case 'ring':
          const ringRadius = Math.sqrt(
            Math.pow(pos.x - this.startPos.x, 2) +
            Math.pow(pos.y - this.startPos.y, 2)
          )
          this.currentShape.innerRadius(ringRadius * 0.5)
          this.currentShape.outerRadius(ringRadius)
          break
      }
      
      this.layer.batchDraw()
    })

    this.stage.on('mouseup touchend', () => {
      if (this.currentShape) {
        // Add unique ID to new shapes
        this.currentShape._id = Date.now() + Math.random().toString(36).substr(2, 9)
        this.history.push(this.currentShape)
        this.saveCanvasState()
        this.log('New shape added with ID: ' + this.currentShape._id)
      }
      this.isDrawing = false
      this.currentShape = null
    })

    // Add transformers for text and labels
    this.stage.on('click tap', (e) => {
      // If we clicked on empty area - remove all transformers
      if (e.target === this.stage) {
        return;
      }

      // If we clicked on a draggable item
      const clickedShape = e.target;
      if (clickedShape.draggable()) {
        // Move clicked shape to the top
        clickedShape.moveToTop();
        this.layer.batchDraw();
      }
    });

    // Load saved state after initializing stage
    setTimeout(() => {
      this.loadCanvasState()
      this.log('Requesting saved state from helper')
    }, 200)
  },

  stop() {
    this.log('Stopping module')
    window.removeEventListener('resize', this.updateDimensions)
    window.removeEventListener('beforeunload', this.saveCanvasState)
    this.saveCanvasState()
  },

  updateDimensions() {
    if (this.stage) {
      const container = document.getElementById('konva-container')
      if (container) {
        const windowWidth = window.innerWidth
        const windowHeight = window.innerHeight
        const margin = 100
        const newWidth = windowWidth - margin
        const newHeight = windowHeight - margin
        
        container.style.width = `${newWidth}px`
        container.style.height = `${newHeight}px`
        this.stage.width(newWidth)
        this.stage.height(newHeight)
        this.stage.draw()
      }
    }
  },

  undo() {
    if (this.history.length > 0) {
      const lastShape = this.history.pop()
      lastShape.destroy()
      this.layer.batchDraw()
      this.saveCanvasState()
      this.log('Undo performed and state saved')
    }
  },

  clearAll() {
    this.log('Clearing all shapes')
    // Clear history and destroy all shapes
    while(this.history.length > 0) {
      const shape = this.history.pop()
      shape.destroy()
    }
    
    // Clear any remaining transformers
    const transformers = this.layer.find('Transformer')
    transformers.forEach(transformer => {
      transformer.destroy()
    })
    
    // Clear the layer
    this.layer.clear()
    this.layer.batchDraw()
    
    // Reset selected shape
    this.config.selectedShape = null
    
    // Disable delete button
    const deleteButton = document.getElementById('delete-button')
    if (deleteButton) {
      deleteButton.disabled = true
    }
    
    // Save empty state
    this.saveCanvasState()
    this.log('All shapes cleared')
  },

  saveCanvasState() {
    if (this.stage) {
      try {
        // Get unique shapes from history (prevent duplicates)
        const uniqueShapes = [...new Set(this.history)]
        
        const state = {
          shapes: uniqueShapes.map(shape => {
            const baseData = {
              className: shape.getClassName(),
              attrs: shape.attrs,
              id: shape._id || Date.now() + Math.random().toString(36).substr(2, 9) // Unique ID for each shape
            }

            if (shape.getClassName() === 'Label') {
              baseData.children = shape.getChildren().map(child => ({
                className: child.getClassName(),
                attrs: child.attrs
              }))
            }

            return baseData
          })
        }
        
        this.sendSocketNotification('SAVE_STATE', state)
        this.log(`Saving canvas state with ${uniqueShapes.length} unique shapes`)
      } catch (error) {
        this.logError(`Error preparing canvas state: ${error.toString()}`)
      }
    }
  },

  loadCanvasState() {
    this.log('Loading saved state')
    // Clear existing shapes before loading
    while(this.history.length > 0) {
      const shape = this.history.pop()
      shape.destroy()
    }
    this.layer.clear()
    this.layer.batchDraw()
    
    this.sendSocketNotification('LOAD_STATE')
  },

  // Add log prefix
  getLogPrefix() {
    return `${this.name}: `;
  },

  // Add logging methods
  log(msg) {
    Log.info(this.getLogPrefix() + msg);
  },

  logError(msg) {
    Log.error(this.getLogPrefix() + msg);
  },

  notificationReceived: function(notification, payload, sender) {
    if (notification === "DOM_OBJECTS_CREATED") {
      this.log("DOM objects created notification received")
      const keyboard = document.getElementById('keyboard-container')
      const textInput = document.getElementById('text-input')
      if (keyboard && textInput) {
        this.log("Keyboard and text input elements found in DOM")
      } else {
        this.logError("Could not find keyboard or text input elements in DOM")
      }
    }
  }
})
