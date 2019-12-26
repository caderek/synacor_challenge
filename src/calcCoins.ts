import { permutations } from "iter-tools"

enum Coins {
  red = 2,
  corroded = 3,
  shiny = 5,
  concave = 7,
  blue = 9,
}

const calc = (a, b, c, d, e) => a + b * c ** 2 + d ** 3 - e

for (const [a, b, c, d, e] of permutations([2, 3, 5, 7, 9])) {
  const result = calc(a, b, c, d, e)

  if (result === 399) {
    console.log(Coins[a], Coins[b], Coins[c], Coins[d], Coins[e])
    break
  }
}

// -> blue red shiny concave corroded
