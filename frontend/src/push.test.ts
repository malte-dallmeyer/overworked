import { expect, it } from 'vitest'
import { base64UrlToBytes } from './push'

it('turns a base64url key into bytes', () => {
  expect([...base64UrlToBytes('BP8_-w')]).toEqual([0x04, 0xff, 0x3f, 0xfb])
})
