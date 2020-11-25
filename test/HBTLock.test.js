const { expectRevert, time, BN } = require('@openzeppelin/test-helpers');
const HBTLock = artifacts.require('HBTLock');
const MasterChef = artifacts.require('MasterChef');
const MockERC20 = artifacts.require('MockERC20');
const HBTToken = artifacts.require('HBTToken');
const PlayerBook = artifacts.require('PlayerBook');
const  web3 = require("web3");

contract('HBTLock', ([alice, bob, carol, dev, minter]) => {
    beforeEach(async () => {
        this.hbt = await HBTToken.new({ from: alice });
        this.hbtLock = await HBTLock.new(this.hbt.address,{ from: alice });
        this.playerBook = await PlayerBook.new(dev,{ from: alice });

        this.lp = await MockERC20.new('LPToken', 'LP', '10000000000', { from: alice });
        await this.lp.transfer(alice, '1000', { from: alice });
        await this.lp.transfer(bob, '1000', { from: alice });
        await this.lp.transfer(carol, '1000', { from: alice });
        this.lp2 = await MockERC20.new('LPToken2', 'LP2', '10000000000', { from: alice });
        await this.lp2.transfer(alice, '1000', { from: alice });
        await this.lp2.transfer(bob, '1000', { from: alice });
        await this.lp2.transfer(carol, '1000', { from: alice });
    });

    // it('收益抵押', async () => {

    //        // 1000 per block farming rate starting at block 500 with bonus until block 600
    //        this.chef = await MasterChef.new(this.hbt.address, this.hbtLock.address , dev, '1000', '500', '600', { from: alice });
    //        this.hbt.setAllowMintAddr(this.chef.address,true); //设置铸币白名单
    //        await this.hbtLock.setMasterChef(this.chef.address, { from: alice });

    //        await this.lp.approve(this.chef.address, '1000', { from: alice });
    //        await this.chef.add('1', this.lp.address, true);
    //        // Alice deposits 10 LPs at block 590
    //        await time.advanceBlockTo('3800');
    //        await this.chef.deposit(0, '10', { from: alice });
    //        // At block 605, she should have 1000*15 + 100*15 = 10500 pending.
    //        await time.advanceBlockTo('3802');
    //     //    assert.equal((await this.chef.pendingHbt(0, alice)).valueOf(), '15000');
    //     //    // At block 606, Alice withdraws all pending rewards and should get 10600.
    //     //    await this.chef.withdraw(0, '0', { from: alice });
    //     //    assert.equal((await this.chef.pendingHbt(0, alice)).valueOf(), '0');
    //     //    assert.equal((await this.hbt.balanceOf(alice)).valueOf(), '16000');

    //     await this.chef.profitLock(0,15, { from: alice });
    //     console.log("await this.hbt.balanceOf(this.hbtLock.address)).valueOf()",(await this.hbt.balanceOf(this.hbtLock.address)).toString());
    //     console.log("hbtLock.timesAwardTotal",  (await this.hbtLock.timesAwardTotal.call()).valueOf().toString())
    //     console.log("hbtLock.depositTotal",  (await this.hbtLock.depositTotal.call()).valueOf().toString())
    //     console.log("hbtLock.pickDepositTotal",  (await this.hbtLock.pickDepositTotal.call()).valueOf().toString())
    //     console.log("hbtLock.pickTimesAwardTotal",  (await this.hbtLock.pickTimesAwardTotal.call()).valueOf().toString())

    //     console.log("hbtLock.depositInfo.endBlock",  (await this.hbtLock.depositInfo.call(alice,0)).endBlock.toString())
    //     console.log("hbtLock.depositInfo.number",  (await this.hbtLock.depositInfo.call(alice,0)).number.toString())
    //     console.log("hbtLock.depositInfo.times",  (await this.hbtLock.depositInfo.call(alice,0)).times.toString())

    // });
    it('可解锁数量', async () => {

        // 1000 per block farming rate starting at block 500 with bonus until block 600
        this.chef = await MasterChef.new(this.hbt.address, this.hbtLock.address, '1000', '0', '600', this.playerBook.address, { from: alice });
        this.hbt.setAllowMintAddr(this.chef.address,true); //设置铸币白名单
        await this.hbtLock.setMasterChef(this.chef.address, { from: alice });

        await this.lp.approve(this.chef.address, '1000', { from: alice });
        await this.chef.add('1', this.lp.address, true);
        // Alice deposits 10 LPs at block 590
        await time.advanceBlockTo('100');
        await this.chef.deposit(0, '10', { from: alice });
        // At block 605, she should have 1000*15 + 100*15 = 10500 pending.
        await time.advanceBlockTo('102');

        await time.advanceBlockTo('132');
        console.log("await this.chef.pendingHbtShow(0,alice)",(await this.chef.pendingHbtShow(0,alice)).valueOf().toString())
        await this.chef.extractReward(0,12,true, { from: alice });
        console.log("hbtLock.depositInfo.endBlock",  (await this.hbtLock.depositInfo.call(alice,0)).endBlock.toString())
        console.log("hbtLock.depositInfo.number",  (await this.hbtLock.depositInfo.call(alice,0)).number.toString())
        console.log("hbtLock.depositInfo.times",  (await this.hbtLock.depositInfo.call(alice,0)).times.toString())
        console.log("this.hbt.balanceOf(this.hbtLock.address))",(await this.hbt.balanceOf(this.hbtLock.address)).toString())

        await time.advanceBlockTo('3772');
        console.log("unlockInfo",(await this.hbtLock.unlockInfo(alice))[0].toString())
        console.log("unlockInfo",(await this.hbtLock.unlockInfo(alice))[1].toString())
        await this.hbtLock.withdraw({from: alice})


        console.log("this.hbt.balanceOf(alice))",(await this.hbt.balanceOf(alice)).toString())

    });

    // it('可解锁数量', async () => {

    //     // 1000 per block farming rate starting at block 500 with bonus until block 600
    //     this.chef = await MasterChef.new(this.hbt.address, this.hbtLock.address, '1000', '0', '600', this.playerBook.address, { from: alice });
    //     this.hbt.setAllowMintAddr(this.chef.address,true); //设置铸币白名单
    //     await this.hbtLock.setMasterChef(this.chef.address, { from: alice });

    //     await this.lp.approve(this.chef.address, '1000', { from: alice });
    //     await this.chef.add('1', this.lp.address, true);
    //     // Alice deposits 10 LPs at block 590
    //     await time.advanceBlockTo('100');
    //     await this.chef.deposit(0, '10', { from: alice });
    //     // At block 605, she should have 1000*15 + 100*15 = 10500 pending.
    //     await time.advanceBlockTo('102');

    //     await time.advanceBlockTo('132');
    //     console.log("await this.chef.pendingHbtShow(0,alice)",(await this.chef.pendingHbtShow(0,alice)).valueOf().toString())
    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     console.log("hbtLock.depositInfo.endBlock",  (await this.hbtLock.depositInfo.call(alice,0)).endBlock.toString())
    //     console.log("hbtLock.depositInfo.number",  (await this.hbtLock.depositInfo.call(alice,0)).number.toString())
    //     console.log("hbtLock.depositInfo.times",  (await this.hbtLock.depositInfo.call(alice,0)).times.toString())
    //     console.log("this.hbt.balanceOf(this.hbtLock.address))",(await this.hbt.balanceOf(this.hbtLock.address)).toString())

    //     await time.advanceBlockTo('172');
    //     console.log("unlockInfo",(await this.hbtLock.unlockInfo(alice))[0].toString())
    //     console.log("unlockInfo",(await this.hbtLock.unlockInfo(alice))[1].toString())
    //     await this.hbtLock.withdraw({from: alice})

    //     console.log("======================")

    //     await time.advanceBlockTo('178');
    //     console.log("await this.chef.pendingHbtShow(0,alice)",(await this.chef.pendingHbtShow(0,alice)).valueOf().toString())
    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     console.log("hbtLock.depositInfo.endBlock",  (await this.hbtLock.depositInfo.call(alice,0)).endBlock.toString())
    //     console.log("hbtLock.depositInfo.number",  (await this.hbtLock.depositInfo.call(alice,0)).number.toString())
    //     console.log("hbtLock.depositInfo.times",  (await this.hbtLock.depositInfo.call(alice,0)).times.toString())
    //     console.log("this.hbt.balanceOf(this.hbtLock.address))",(await this.hbt.balanceOf(this.hbtLock.address)).toString())

    //     await time.advanceBlockTo('218');
    //     console.log("unlockInfo",(await this.hbtLock.unlockInfo(alice))[0].toString())
    //     console.log("unlockInfo",(await this.hbtLock.unlockInfo(alice))[1].toString())
    //     await this.hbtLock.withdraw({from: alice})

    // });

    // it('关闭合约开启合约', async () => {
    //     this.chef = await MasterChef.new(this.hbt.address, this.hbtLock.address, '1000', '0', '600', this.playerBook.address, { from: alice });
    //     this.hbt.setAllowMintAddr(this.chef.address,true); //设置铸币白名单
    //     await this.hbtLock.setMasterChef(this.chef.address, { from: alice });

    //     await this.lp.approve(this.chef.address, '1000', { from: alice });
    //     await this.chef.add('1', this.lp.address, true);
    //     await time.advanceBlockTo('309');
    //     await this.chef.deposit(0, '10', { from: alice });
    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('370');
    //     await this.hbtLock.withdraw({from: alice})
    //     await this.hbtLock.setClose(true,{from: alice});
    //     await this.hbtLock.setClose(false,{from: alice});

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('440');

    //     await this.hbtLock.withdraw({from: alice});
    // })

    // it('20次连续抵押并提币', async () => {
    //     this.chef = await MasterChef.new(this.hbt.address, this.hbtLock.address, '1000', '0', '600', this.playerBook.address, { from: alice });
    //     this.hbt.setAllowMintAddr(this.chef.address,true); //设置铸币白名单
    //     await this.hbtLock.setMasterChef(this.chef.address, { from: alice });

    //     await this.lp.approve(this.chef.address, '1000', { from: alice });
    //     await this.chef.add('1', this.lp.address, true);
    //     await time.advanceBlockTo('509');
    //     await this.chef.deposit(0, '10', { from: alice });

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('570');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('572');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('574');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('576');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('578');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('580');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('582');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('584');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('586');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('588');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('590');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('592');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('594');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('596');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('598');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('600');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('602');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('604');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('606');

    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('670');
    //     await this.hbtLock.withdraw({from: alice});


    //     await this.chef.extractReward(0,12,true, { from: alice });
    //     await time.advanceBlockTo('780');

    //     console.log("unlockInfo",(await this.hbtLock.unlockInfo(alice))[0].toString())
    //     console.log("unlockInfo",(await this.hbtLock.unlockInfo(alice))[1].toString())
    //     console.log("await this.hbt.balanceOf(this.hbtLock.address).valueOf().toString()",(await this.hbt.balanceOf(this.hbtLock.address).valueOf()).toString());
    //     await this.hbtLock.withdraw({from: alice});
    // });

    // it('合约创建成功之后普通用户进行交易抵押', async () => {
    //     this.chef = await MasterChef.new(this.hbt.address, this.hbtLock.address, '1000', '0', '600', this.playerBook.address, { from: alice });
    //     this.hbt.setAllowMintAddr(this.chef.address,true); //设置铸币白名单
    //     await this.hbtLock.setMasterChef(this.chef.address, { from: alice });

    //     await this.lp.approve(this.chef.address, '1000', { from: bob });
    //     await this.chef.add('1', this.lp.address, true);
    //     await time.advanceBlockTo('809');
    //     await this.chef.deposit(0, '10', { from: bob });

    //     await this.chef.extractReward(0,12,true, { from: bob });
    //     await time.advanceBlockTo('870');
    //     await this.hbtLock.withdraw({from: bob});
    // });

    // it('调用unlockInfoOpt方法', async () => {
    //     this.chef = await MasterChef.new(this.hbt.address, this.hbtLock.address, '1000', '0', '600', this.playerBook.address, { from: alice });
    //     this.hbt.setAllowMintAddr(this.chef.address,true); //设置铸币白名单
    //     await this.hbtLock.setMasterChef(this.chef.address, { from: alice });

    //     await this.lp.approve(this.chef.address, '1000', { from: bob });
    //     await this.chef.add('1', this.lp.address, true);
    //     await time.advanceBlockTo('19');
    //     await this.chef.deposit(0, '10', { from: bob });
    //     await time.advanceBlockTo('20');
    //     await this.chef.extractReward(0,12,true, { from: bob });
    //     await time.advanceBlockTo('100');
    //     await this.hbtLock.unlockInfoOpt({from: bob});
    // });
});