const { expectRevert, time, BN } = require('@openzeppelin/test-helpers');
const ether = require('@openzeppelin/test-helpers/src/ether');
const PlayerBook = artifacts.require('PlayerBook');

contract('PlayerBook', ([alice, bob, carol, dev, minter]) => {
    beforeEach(async () => {
        this.playerBook = await PlayerBook.new(bob,{ from: alice });
    });

    it('生成注册连接', async () => {
        let fee = await this.playerBook.getRegistrationFee()
        console.log("fee",fee.valueOf().toString())
        console.log("bob",bob)
        await this.playerBook.registerNameXName('houyi','',{from: alice, value:fee})
        var aliceName = await this.playerBook.getPlayerName(alice)
        aliceName = web3.utils.hexToUtf8(aliceName)
        // console.log('aliceName2 - hexToUtf8' , aliceName)
        // console.log('aliceName' , aliceName.trim().length)
        assert.equal(aliceName,'houyi')
        await this.playerBook.seizeEth()
    });
});