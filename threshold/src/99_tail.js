// Boot.
Post.init();
if (QS.has('bot')) Bot.level = +QS.get('bot') || 0;
if (QS.has('god')) G.god = true;
if (QS.get('class')) Settings.cls = QS.get('class');
G.state = 'menu';
if (QS.has('boss')) Game.start(QS.get('boss'), { skipIntro: QS.has('skipintro'), phase: +(QS.get('phase') || 0) });
else Game.toMenu();
requestAnimationFrame(frame);
