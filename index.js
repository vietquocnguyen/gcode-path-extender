#!/usr/bin/env node
 

const program = require('commander');
const fs = require('fs')

program
  .version('1.0.0')
  .usage('[options] <input file> [output file]')
  .option('-t, --tool-off-gcode [gcode]', 'Tool Off GCODE', 'G1 Z3')
  .option('-e, --extend [millimeters]', 'Extend each path by how many millimeters', 4)
  .parse(process.argv);
 
let mmExtension = program.extend; // How many mm to extend the path by

var file = program.args[0]
var outputFile = program.args[1]
var gcode = fs.readFileSync(file).toString();

var toolOff = program.toolOffGcode;

// console.log('-- BEGIN ---')
var chunks = gcode.split(toolOff)

let newChunks = chunks.map(function(chunk, chunkIndex){
  // Ignore the last chunk
  let theMatch = chunk.match(/Pass \d+ Path \d+/)
  let newChunk = chunk + "\n"
  if(theMatch){
    newChunk += "; INJECTION START\n"
    // console.log('hi', chunk)
    let totalDistance = 0
    let initialLine = chunk.match(/G0 X([0-9.]+) Y([0-9.]+)/)
    if (!initialLine) {
      // console.log(chunkIndex)
      throw new Error(`No initial line for chunk #${chunkIndex}`)
    }
    let initialX = initialLine[1]
    let initialY = initialLine[2]
    // console.log('Initial Coordinates:', initialX, initialY)

    var lines = chunk.match(/G1 X.*/g)
    let lineArray = lines.map(function(line, lineIndex){
      let lineMatch = line.match(/X([0-9.]+) Y([0-9.]+)/)
      if (!lineMatch) throw new Error('Line Match Corrupted')
      return {
        raw: line,
        x: lineMatch[1],
        y: lineMatch[2]
      }
    })

    let upUntilLineNumber = lineArray.length - 1

    lineArray.every(function(lineObj, lineIndex){
      let X1 = 0
      let Y1 = 0
      let X2 = lineObj.x
      let Y2 = lineObj.y
      if(lineIndex === 0){
        X1 = initialX
        Y1 = initialY
      } else {
        X1 = lineArray[lineIndex-1].x
        Y1 = lineArray[lineIndex-1].y
      }
      let distance = Math.sqrt( (X1 - X2)*(X1 - X2) + (Y1 - Y2)*(Y1 - Y2) )
      totalDistance += distance
      //         console.log('Line #', lineIndex)
      //         console.log('-- Prev', X1, Y1)
      //         console.log('-- Now', X2, Y2)
      //         console.log('-- Distance', distance)
      //         console.log('-- Total Distance', totalDistance)

      if(totalDistance >= mmExtension) {
        upUntilLineNumber = lineIndex
        return false
      }

      return true

    })
    // console.log('Up Until Line Number:', upUntilLineNumber, 'of', lineArray.length)
    
    for(let i = 0; i <= upUntilLineNumber; i++) {
      newChunk += lines[i].match(/G1 X[0-9.]+ Y[0-9.]+/g)[0] + "\n"
    }
    


    newChunk += `; END INJECTION (Added ${upUntilLineNumber-1} lines of the total ${lines.length} lines in this path)\n\n`
  }
  
  
  if(chunkIndex !== chunks.length -1){
    newChunk += toolOff
  } 
  

  return newChunk
})

var finalOutputGCODE = newChunks.join("")

if (outputFile) {
  fs.writeFileSync(outputFile, finalOutputGCODE)
} else {
  console.log(finalOutputGCODE)
}
