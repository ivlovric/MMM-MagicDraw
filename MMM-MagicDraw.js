Module.register("MMM-MagicDraw", {

  defaults: {
    backgroundColor: "#f5f5f5",
    currentShape: 'freehand',
    fontSize: 20,
    textColor: '#000000',
    labelBackgroundColor: '#333333',
    pointerDirection: 'none'
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
    this.stage = null
    this.layer = null
    this.isDrawing = false
    this.lastLine = null
    this.currentShape = null
    this.startPos = null
    this.history = []  // Add history array to store shapes
    this.updateDimensions = this.updateDimensions.bind(this)
    window.addEventListener('resize', this.updateDimensions)
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
    }
  },

  /**
   * Render the page we're on.
   */
  getDom() {
    const wrapper = document.createElement("div")
    wrapper.id = "drawing-container"
    
    // Create controls container
    const controls = document.createElement("div")
    controls.id = "shape-controls"
    
    // Add undo button
    const undoButton = document.createElement("button")
    undoButton.id = "undo-button"
    undoButton.innerHTML = "Undo"
    undoButton.addEventListener('click', () => this.undo())
    
    // Add clear all button
    const clearButton = document.createElement("button")
    clearButton.id = "clear-button"
    clearButton.innerHTML = "Clear All"
    clearButton.addEventListener('click', () => this.clearAll())
    
    // Shape selector
    const shapeSelector = document.createElement("select")
    shapeSelector.id = "shape-selector"
    const shapes = ['freehand', 'rectangle', 'circle', 'line', 'text', 'label']
    shapes.forEach(shape => {
      const option = document.createElement("option")
      option.value = shape
      option.text = shape.charAt(0).toUpperCase() + shape.slice(1)
      shapeSelector.appendChild(option)
    })
    
    shapeSelector.addEventListener('change', (e) => {
      this.config.currentShape = e.target.value
    })
    
    // Arrow direction selector
    const arrowSelector = document.createElement("select")
    arrowSelector.id = "arrow-selector"
    const directions = ['none', 'left', 'right', 'up', 'down']
    directions.forEach(direction => {
      const option = document.createElement("option")
      option.value = direction
      option.text = direction.charAt(0).toUpperCase() + direction.slice(1)
      arrowSelector.appendChild(option)
    })
    
    arrowSelector.addEventListener('change', (e) => {
      this.config.pointerDirection = e.target.value
    })

    // Color picker for label background
    const colorPicker = document.createElement("input")
    colorPicker.type = "color"
    colorPicker.id = "color-picker"
    colorPicker.value = this.config.labelBackgroundColor
    
    colorPicker.addEventListener('change', (e) => {
      this.config.labelBackgroundColor = e.target.value
    })
    
    // Text input for labels
    const textInput = document.createElement("input")
    textInput.type = "text"
    textInput.id = "text-input"
    textInput.placeholder = "Enter text..."
    
    // Font size input
    const fontSizeInput = document.createElement("input")
    fontSizeInput.type = "number"
    fontSizeInput.id = "font-size-input"
    fontSizeInput.value = this.config.fontSize
    fontSizeInput.min = "8"
    fontSizeInput.max = "72"
    
    fontSizeInput.addEventListener('change', (e) => {
      this.config.fontSize = parseInt(e.target.value)
    })
    
    // Add all controls to the container
    controls.appendChild(undoButton)
    controls.appendChild(clearButton)
    controls.appendChild(shapeSelector)
    controls.appendChild(textInput)
    controls.appendChild(fontSizeInput)
    controls.appendChild(arrowSelector)
    controls.appendChild(colorPicker)
    wrapper.appendChild(controls)
    
    // Create container for Konva stage
    const container = document.createElement("div")
    container.id = "konva-container"
    wrapper.appendChild(container)

    // Initialize Konva after DOM element is created
    setTimeout(() => {
      if (!this.stage) {
        this.initKonva()
        this.updateDimensions()
      }
    }, 100)

    return wrapper
  },

  initKonva() {
    this.stage = new Konva.Stage({
      container: 'konva-container',
      width: 100,
      height: 100
    })

    this.layer = new Konva.Layer()
    this.stage.add(this.layer)

    // Modified drawing functionality
    this.stage.on('mousedown touchstart', () => {
      this.isDrawing = true
      this.startPos = this.stage.getPointerPosition()

      switch(this.config.currentShape) {
        case 'freehand':
          this.lastLine = new Konva.Line({
            stroke: '#000000',
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
            stroke: '#000000',
            strokeWidth: 2
          })
          break;
          
        case 'circle':
          this.currentShape = new Konva.Circle({
            x: this.startPos.x,
            y: this.startPos.y,
            radius: 0,
            stroke: '#000000',
            strokeWidth: 2
          })
          break;
          
        case 'line':
          this.currentShape = new Konva.Line({
            points: [this.startPos.x, this.startPos.y, this.startPos.x, this.startPos.y],
            stroke: '#000000',
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
              fill: this.config.textColor,
              draggable: true
            })
            this.layer.add(this.currentShape)
            this.layer.batchDraw()
            this.history.push(this.currentShape)
            
            // Clear the input after adding text
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
              fill: this.config.labelBackgroundColor,
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
              fill: this.config.textColor,
            }));

            this.layer.add(label);
            this.layer.batchDraw();
            this.history.push(label)
            
            // Clear the input after adding label
            textInputLabel.value = '';
          }
          this.isDrawing = false;
          break;
      }
      
      if (this.currentShape && !['text', 'label'].includes(this.config.currentShape)) {
        this.layer.add(this.currentShape)
      }
    })

    this.stage.on('mousemove touchmove', () => {
      if (!this.isDrawing) return

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
      }
      
      this.layer.batchDraw()
    })

    this.stage.on('mouseup touchend', () => {
      if (this.currentShape) {
        this.history.push(this.currentShape)  // Add shape to history
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
  },

  addRandomText() {
    this.sendSocketNotification("GET_RANDOM_TEXT", { amountCharacters: 15 })
  },

  /**
   * This is the place to receive notifications from other modules or the system.
   *
   * @param {string} notification The notification ID, it is preferred that it prefixes your module name
   * @param {number} payload the payload type.
   */
  notificationReceived(notification, payload) {
    if (notification === "TEMPLATE_RANDOM_TEXT") {
      this.templateContent = `${this.config.exampleContent} ${payload}`
      this.updateDom()
    }
  },

  stop() {
    window.removeEventListener('resize', this.updateDimensions)
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
    }
  },

  clearAll() {
    // Remove all shapes from history
    while(this.history.length > 0) {
      const shape = this.history.pop()
      shape.destroy()
    }
    // Clear the layer
    this.layer.clear()
    this.layer.batchDraw()
  }
})
