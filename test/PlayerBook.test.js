const { expectRevert, time, BN } = require('@openzeppelin/test-helpers');
const PlayerBook = artifacts.require('PlayerBook');

contract('PlayerBook', ([alice, bob, carol, dev, minter]) => {
    beforeEach(async () => {
        this.playerBook = await PlayerBook.new(dev,{ from: alice });
    });

    it('生成注册连接', async () => {
        let fee = await this.playerBook.getRegistrationFee()
        console.log("fee",fee)
        await this.playerBook.registerNameXName('houyi','',{from: alice, value: fee})
        var aliceName = await this.playerBook.getPlayerName(alice)
        aliceName = web3.utils.hexToUtf8(aliceName)
        console.log('aliceName2 - hexToUtf8' , aliceName)
        console.log('aliceName' , aliceName.trim().length)
        assert.equal(aliceName,'houyi')
    });
});