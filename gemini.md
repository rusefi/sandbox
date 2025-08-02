Can i have web serial api hello world app

please have javaScript and html in separate files

use https://github.com/rusefi/rusefi/commit/f2c1a0ae28428dfcb68837e9a081274973de6417 logic to check if port is openblt or not

reader.read needs 500ms timeout

implement getSignature method using https://github.com/rusefi/rusefi/blob/0b49e9cf092b80f142fd8cacff17aba3baeef2d7/java_console/io/src/main/java/com/rusefi/binaryprotocol/BinaryProtocol.java#L155
https://github.com/rusefi/rusefi/blob/b01641065e8b946ad697d01f361e42f765c428c0/java_console/io/src/main/java/com/rusefi/io/commands/HelloCommand.java#L24-L23
https://github.com/rusefi/rusefi/blob/c3635f7c8d186c115b228d135f3dcdb273c9f010/java_console/io/src/main/java/com/rusefi/io/IoStream.java#L58
https://github.com/rusefi/rusefi/blob/b01641065e8b946ad697d01f361e42f765c428c0/java_console/io/src/main/java/com/rusefi/binaryprotocol/IoHelper.java#L30

if not openblt execute getSignature

did you notice IoHelper.makeCrc32Packet

log all bytes send or received on console