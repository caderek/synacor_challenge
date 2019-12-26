import { readFileSync, writeFileSync, existsSync } from "fs"
import * as readline from "readline"

const MODULUS = 32768
const saveFile = "src/save.txt"

enum Opcode {
  HALT,
  SET,
  PUSH,
  POP,
  EQ,
  GT,
  JMP,
  JT,
  JF,
  ADD,
  MULT,
  MOD,
  AND,
  OR,
  NOT,
  RMEM,
  WMEM,
  CALL,
  RET,
  OUT,
  IN,
  NOOP,
}

const Jump = {
  [Opcode.SET]: 3,
  [Opcode.PUSH]: 2,
  [Opcode.POP]: 2,
  [Opcode.EQ]: 4,
  [Opcode.GT]: 4,
  [Opcode.JT]: 3,
  [Opcode.JF]: 3,
  [Opcode.ADD]: 4,
  [Opcode.MULT]: 4,
  [Opcode.MOD]: 4,
  [Opcode.AND]: 4,
  [Opcode.OR]: 4,
  [Opcode.NOT]: 3,
  [Opcode.RMEM]: 3,
  [Opcode.WMEM]: 3,
  [Opcode.CALL]: 2,
  [Opcode.RET]: 1,
  [Opcode.OUT]: 2,
  [Opcode.IN]: 2,
  [Opcode.NOOP]: 1,
}

const mod = (a: number, b: number) => a - b * Math.floor(a / b)

const decode = (bin: Uint16Array) => {
  const program = new Uint16Array(bin.length / 2)

  for (let i = 0, j = 0; i <= bin.length; i += 2, j++) {
    program[j] = bin[i + 1] * 256 + bin[i]
  }

  return program
}

const save = (commands: string[]) => {
  writeFileSync(saveFile, commands.map((command) => `${command}\n`).join(""), {
    flag: "a",
  })

  console.log("Saved!")
}

const restore = () => {
  if (!existsSync(saveFile)) {
    return []
  }

  return readFileSync(saveFile)
    .toString()
    .split("\n")
    .slice(0, -1)
    .map((line) =>
      line
        .split("")
        .map((char) => char.charCodeAt(0))
        .concat([10]),
    )
    .flat()
}

const compute = async (program: Uint16Array) => {
  const commands = []
  let pointer = 0
  let inputs = restore()
  const registers = new Uint16Array(8)
  const stack = []
  let hacked = false

  const get = (val: number) => {
    if (val >= 32776) {
      throw new Error(`Invalid value ${val}`)
    }

    if (val >= 32768) {
      return registers[val - 32768]
    }

    return val
  }

  const set = (address: number, val: number) => {
    if (address >= 32776) {
      throw new Error(`Invalid address ${address}`)
    }

    if (address >= 32768) {
      registers[address - 32768] = val
    } else {
      program[address] = val
    }
  }

  const read = () => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    return new Promise((resolve) => {
      rl.question("", (command) => {
        if (command === "save") {
          save(commands)
        } else if (command === "hack") {
          registers[7] = 1
          hacked = true
          console.log("Hacked!")
        } else {
          commands.push(command)

          if (hacked) {
            writeFileSync(
              "src/hacked.log",
              `------------>${command}<------------\n`,
              { flag: "a" },
            )
          }

          inputs = command
            .split("")
            .map((char) => char.charCodeAt(0))
            .concat([10])
        }

        resolve()
        rl.close()
      })
    })
  }

  let halt = false

  while (!halt) {
    const opcode = program[pointer]
    let autoJump = true

    if (hacked) {
      writeFileSync(
        "hacked.log",
        `${Opcode[opcode].padEnd(4, " ")} | pointer: ${String(pointer).padStart(
          6,
          " ",
        )} | args: ${Array.from(
          { length: Jump[opcode] - 1 },
          (_, i) =>
            `${String(program[pointer + i + 1]).padStart(
              8,
              " ",
            )} (val: ${String(get(program[pointer + i + 1])).padStart(
              8,
              " ",
            )})`,
        ).join(", ")}\n`,
        { flag: "a" },
      )

      // console.log({
      //   op: Opcode[opcode],
      //   pointer,
      //   args: Array.from(
      //     { length: Jump[opcode] - 1 },
      //     (_, i) => program[pointer + i + 1],
      //   ),
      // })
    }

    switch (opcode) {
      case Opcode.HALT: {
        halt = true
        break
      }
      case Opcode.SET: {
        set(program[pointer + 1], get(program[pointer + 2]))
        break
      }

      case Opcode.PUSH: {
        stack.push(get(program[pointer + 1]))
        break
      }

      case Opcode.POP: {
        if (stack.length === 0) {
          throw new Error("Stack is empty!")
        }
        set(program[pointer + 1], get(stack.pop()))
        break
      }

      case Opcode.EQ: {
        set(
          program[pointer + 1],
          get(program[pointer + 2]) === get(program[pointer + 3]) ? 1 : 0,
        )
        break
      }

      case Opcode.GT: {
        set(
          program[pointer + 1],
          get(program[pointer + 2]) > get(program[pointer + 3]) ? 1 : 0,
        )
        break
      }

      case Opcode.JMP: {
        pointer = get(program[pointer + 1])
        autoJump = false
        break
      }

      case Opcode.JT: {
        if (get(program[pointer + 1]) !== 0) {
          pointer = get(program[pointer + 2])
          autoJump = false
        }
        break
      }

      case Opcode.JF: {
        if (get(program[pointer + 1]) === 0) {
          pointer = get(program[pointer + 2])
          autoJump = false
        }
        break
      }

      case Opcode.ADD: {
        set(
          program[pointer + 1],
          mod(get(program[pointer + 2]) + get(program[pointer + 3]), MODULUS),
        )
        break
      }

      case Opcode.MULT: {
        set(
          program[pointer + 1],
          mod(get(program[pointer + 2]) * get(program[pointer + 3]), MODULUS),
        )
        break
      }

      case Opcode.MOD: {
        set(
          program[pointer + 1],
          mod(get(program[pointer + 2]), get(program[pointer + 3])),
        )
        break
      }

      case Opcode.AND: {
        set(
          program[pointer + 1],
          get(program[pointer + 2]) & get(program[pointer + 3]),
        )

        break
      }

      case Opcode.OR: {
        set(
          program[pointer + 1],
          get(program[pointer + 2]) | get(program[pointer + 3]),
        )

        break
      }

      case Opcode.NOT: {
        set(program[pointer + 1], mod(~get(program[pointer + 2]), MODULUS))

        break
      }

      case Opcode.RMEM: {
        set(program[pointer + 1], program[get(program[pointer + 2])])
        break
      }

      case Opcode.WMEM: {
        set(get(program[pointer + 1]), get(program[pointer + 2]))
        break
      }

      case Opcode.CALL: {
        stack.push(pointer + Jump[opcode])
        pointer = get(program[pointer + 1])
        autoJump = false
        break
      }

      case Opcode.RET: {
        if (stack.length === 0) {
          halt = true
        } else {
          pointer = get(stack.pop())
          autoJump = false
        }
        break
      }

      case Opcode.OUT: {
        process.stdout.write(String.fromCharCode(get(program[pointer + 1])))
        break
      }

      case Opcode.IN: {
        if (inputs.length === 0) {
          await read()
        }

        set(program[pointer + 1], inputs.shift())

        break
      }

      case Opcode.NOOP: {
        break
      }

      default: {
        console.log(`Opcode ${opcode} (${Opcode[opcode]}) not handled!`)
        return
      }
    }

    if (autoJump) {
      pointer += Jump[opcode]
    }
  }
}

const main = async () => {
  const bin = new Uint16Array(readFileSync("./challenge.bin"))

  await compute(decode(bin))
}

main()
