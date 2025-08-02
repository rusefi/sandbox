// This file implements the CRC32 checksum and packet creation logic
// based on the rusefi binary protocol.

// CRC32 polynomial for the rusefi protocol (0xEDB88320 reversed)
const CRC32_POLY = 0xEDB88320;
const crc32Table = new Uint32Array(256);

// Pre-compute the CRC32 lookup table
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
        c = (c & 1) ? CRC32_POLY ^ (c >>> 1) : c >>> 1;
    }
    crc32Table[i] = c;
}

/**
 * Calculates the CRC32 checksum of a given Uint8Array.
 * @param {Uint8Array} data - The data to calculate the checksum for.
 * @returns {number} The calculated CRC32 checksum.
 */
export function calculateCrc32(data) {
    let crc = -1; // Initial value is 0xFFFFFFFF
    for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ crc32Table[(crc ^ data[i]) & 0xFF];
    }
    return crc ^ (-1); // Final XOR with 0xFFFFFFFF
}

/**
 * Creates a binary packet with a command, optional payload, and CRC32 checksum.
 * This is based on the BinaryProtocol.java implementation.
 * Packet structure: [payload_length_LE_u16] [command_u8] [payload] [CRC32_LE_u32]
 * @param {number} command - The single-byte command code.
 * @param {Uint8Array} [payload=new Uint8Array(0)] - The optional payload data.
 * @returns {Uint8Array} The complete binary packet.
 */
export function makeCrc32Packet(command, payload = new Uint8Array(0)) {
    // The total length of the content to be CRC'd is command (1 byte) + payload.length
    const contentToCrc = new Uint8Array(1 + payload.length);
    contentToCrc[0] = command;
    contentToCrc.set(payload, 1);

    const crc = calculateCrc32(contentToCrc);
    const totalPacketLength = 2 + contentToCrc.length + 4; // 2 for length, 1 for command, payload.length, 4 for CRC

    // Create the final packet buffer
    const packet = new Uint8Array(totalPacketLength);
    const view = new DataView(packet.buffer);

    // Write payload length (command + payload) as a little-endian 16-bit integer
    // This is the length of the data *between* the length field and the CRC.
    view.setUint16(0, contentToCrc.length, true);

    // Write the command and payload
    packet.set(contentToCrc, 2);

    // Write the CRC32 checksum as a little-endian 32-bit integer
    view.setUint32(2 + contentToCrc.length, crc, true);

    return packet;
}
