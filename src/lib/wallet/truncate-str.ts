export const truncateStr = (text: string, i: number, f: number): string => {
    if (text.length <= (i + f)) {
      return text
    }

    let initial = text.substring(0, i)
    let final = text.substring(text.length - f, text.length)

    return `${initial}...${final}`
}