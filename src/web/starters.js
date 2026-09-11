/**
 * Built-in starter designs
 *
 * Each starter is a factory rather than a literal, so elements are built by
 * the same constructors the app uses everywhere else and cannot drift out of
 * step with the element schema. Positions are in canvas pixels at 8 px/mm,
 * matching the label size each starter declares.
 */

import {
  createTextElement,
  createQRElement,
  createBarcodeElement,
  createShapeElement,
} from './elements.js?v=102';

const MM = 8; // canvas pixels per millimetre

export const STARTERS = [
  {
    id: 'asset-tag',
    name: 'Asset tag',
    description: 'Numbered tag with a matching QR code',
    labelSize: { width: 50, height: 25 },
    build: () => [
      createTextElement('ASSET', {
        x: 4 * MM, y: 3 * MM, width: 22 * MM, height: 5 * MM,
        fontSize: 13, fontWeight: 'bold', align: 'left', verticalAlign: 'middle',
      }),
      createTextElement('{{SN}}', {
        x: 4 * MM, y: 9 * MM, width: 26 * MM, height: 10 * MM,
        fontSize: 30, fontWeight: 'bold', align: 'left', verticalAlign: 'middle',
      }),
      createQRElement('{{SN}}', {
        x: 32 * MM, y: 4 * MM, width: 16 * MM, height: 16 * MM,
      }),
    ],
  },
  {
    id: 'shipping',
    name: 'Shipping label',
    description: 'Address block over a tracking barcode',
    labelSize: { width: 101.6, height: 152.4 },
    build: () => [
      createTextElement('SHIP TO', {
        x: 8 * MM, y: 8 * MM, width: 40 * MM, height: 6 * MM,
        fontSize: 14, fontWeight: 'bold',
      }),
      createTextElement('Name\nStreet address\nCity, State ZIP', {
        x: 8 * MM, y: 16 * MM, width: 84 * MM, height: 28 * MM,
        fontSize: 22, verticalAlign: 'top',
      }),
      createShapeElement('line', {
        x: 8 * MM, y: 100 * MM, width: 84 * MM, height: 1,
      }),
      createBarcodeElement('1Z9999999999999999', {
        x: 8 * MM, y: 108 * MM, width: 84 * MM, height: 28 * MM,
        barcodeFormat: 'CODE128',
      }),
    ],
  },
  {
    id: 'cable',
    name: 'Cable label',
    description: 'Short identifier for a narrow flag label',
    labelSize: { width: 40, height: 12 },
    build: () => [
      createTextElement('{{SN}}', {
        x: 2 * MM, y: 2 * MM, width: 36 * MM, height: 8 * MM,
        fontSize: 26, fontWeight: 'bold', align: 'center', verticalAlign: 'middle',
        noWrap: true,
      }),
    ],
  },
  {
    id: 'storage-jar',
    name: 'Storage jar',
    description: 'Contents and a date stamped at print time',
    labelSize: { width: 50, height: 30 },
    build: () => [
      createTextElement('Contents', {
        x: 4 * MM, y: 4 * MM, width: 42 * MM, height: 10 * MM,
        fontSize: 28, fontWeight: 'bold', align: 'center', verticalAlign: 'middle',
      }),
      createTextElement('[[date]]', {
        x: 4 * MM, y: 18 * MM, width: 42 * MM, height: 7 * MM,
        fontSize: 16, align: 'center', verticalAlign: 'middle',
      }),
    ],
  },
];

/**
 * Look up a starter by id
 * @param {string} id - Starter id
 * @returns {Object|undefined}
 */
export function getStarter(id) {
  return STARTERS.find(s => s.id === id);
}
