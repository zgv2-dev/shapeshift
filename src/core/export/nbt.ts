export const TAG = {
  end: 0,
  byte: 1,
  short: 2,
  int: 3,
  long: 4,
  float: 5,
  double: 6,
  byteArray: 7,
  string: 8,
  list: 9,
  compound: 10,
  intArray: 11,
  longArray: 12,
} as const

export type NbtType = (typeof TAG)[keyof typeof TAG]

export type NbtTag =
  | { type: typeof TAG.byte; value: number }
  | { type: typeof TAG.short; value: number }
  | { type: typeof TAG.int; value: number }
  | { type: typeof TAG.long; value: bigint }
  | { type: typeof TAG.float; value: number }
  | { type: typeof TAG.double; value: number }
  | { type: typeof TAG.byteArray; value: Uint8Array }
  | { type: typeof TAG.string; value: string }
  | { type: typeof TAG.list; elementType: NbtType; value: NbtTag[] }
  | { type: typeof TAG.compound; value: Record<string, NbtTag> }
  | { type: typeof TAG.intArray; value: number[] }
  | { type: typeof TAG.longArray; value: bigint[] | BigInt64Array }

export const nbt = {
  byte: (value: number): NbtTag => ({ type: TAG.byte, value }),
  short: (value: number): NbtTag => ({ type: TAG.short, value }),
  int: (value: number): NbtTag => ({ type: TAG.int, value: Math.round(value) }),
  long: (value: bigint | number): NbtTag => ({
    type: TAG.long,
    value: typeof value === 'bigint' ? value : BigInt(Math.round(value)),
  }),
  float: (value: number): NbtTag => ({ type: TAG.float, value }),
  double: (value: number): NbtTag => ({ type: TAG.double, value }),
  byteArray: (value: Uint8Array): NbtTag => ({ type: TAG.byteArray, value }),
  string: (value: string): NbtTag => ({ type: TAG.string, value }),
  list: (elementType: NbtType, value: NbtTag[]): NbtTag => ({
    type: TAG.list,
    elementType,
    value,
  }),
  compound: (value: Record<string, NbtTag>): NbtTag => ({ type: TAG.compound, value }),
  intArray: (value: number[]): NbtTag => ({ type: TAG.intArray, value: value.map(Math.round) }),
  longArray: (value: bigint[] | BigInt64Array): NbtTag => ({
    type: TAG.longArray,
    value,
  }),
}

class Writer {
  private buf = new Uint8Array(1024)
  private view = new DataView(this.buf.buffer)
  len = 0

  private ensure(n: number): void {
    if (this.len + n <= this.buf.length) return
    let next = this.buf.length * 2
    while (next < this.len + n) next *= 2
    const buf = new Uint8Array(next)
    buf.set(this.buf)
    this.buf = buf
    this.view = new DataView(buf.buffer)
  }

  u8(v: number): void {
    this.ensure(1)
    this.view.setUint8(this.len, v & 0xff)
    this.len += 1
  }

  i32(v: number): void {
    this.ensure(4)
    this.view.setInt32(this.len, v | 0)
    this.len += 4
  }

  i64(v: bigint): void {
    this.ensure(8)
    this.view.setBigInt64(this.len, BigInt.asIntN(64, v))
    this.len += 8
  }

  f32(v: number): void {
    this.ensure(4)
    this.view.setFloat32(this.len, v)
    this.len += 4
  }

  f64(v: number): void {
    this.ensure(8)
    this.view.setFloat64(this.len, v)
    this.len += 8
  }

  u16(v: number): void {
    this.ensure(2)
    this.view.setUint16(this.len, v & 0xffff)
    this.len += 2
  }

  raw(bytes: Uint8Array): void {
    this.ensure(bytes.length)
    this.buf.set(bytes, this.len)
    this.len += bytes.length
  }

  string(value: string): void {
    const bytes = new TextEncoder().encode(value)
    this.u16(bytes.length)
    this.raw(bytes)
  }

  finish(): Uint8Array {
    return this.buf.slice(0, this.len)
  }
}

function writePayload(w: Writer, tag: NbtTag): void {
  switch (tag.type) {
    case TAG.byte:
      w.u8(tag.value)
      break
    case TAG.short:
      w.u16(tag.value)
      break
    case TAG.int:
      w.i32(tag.value)
      break
    case TAG.long:
      w.i64(tag.value)
      break
    case TAG.float:
      w.f32(tag.value)
      break
    case TAG.double:
      w.f64(tag.value)
      break
    case TAG.byteArray:
      w.i32(tag.value.length)
      w.raw(tag.value)
      break
    case TAG.string:
      w.string(tag.value)
      break
    case TAG.list:
      w.u8(tag.elementType)
      w.i32(tag.value.length)
      for (const item of tag.value) writePayload(w, item)
      break
    case TAG.compound:
      for (const [key, value] of Object.entries(tag.value)) {
        w.u8(value.type)
        w.string(key)
        writePayload(w, value)
      }
      w.u8(TAG.end)
      break
    case TAG.intArray:
      w.i32(tag.value.length)
      for (const v of tag.value) w.i32(v)
      break
    case TAG.longArray:
      w.i32(tag.value.length)
      for (const v of tag.value) w.i64(v)
      break
  }
}

export function writeNbt(root: NbtTag): Uint8Array {
  if (root.type !== TAG.compound) throw new Error('NBT root must be a compound tag')
  const w = new Writer()
  w.u8(TAG.compound)
  w.string('')
  writePayload(w, root)
  return w.finish()
}

export function blockStateKey(name: string, props?: Record<string, string>): string {
  if (!props || Object.keys(props).length === 0) return name
  const pairs = Object.keys(props)
    .sort()
    .map((k) => `${k}=${props[k]}`)
    .join(',')
  return `${name}[${pairs}]`
}
