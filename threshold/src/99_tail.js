// Boot.
Post.init();
if (QS.has('bot')) Bot.level = +QS.get('bot') || 0;
if (QS.has('god')) G.god = true;
if (QS.get('class')) Settings.cls = QS.get('class');
G.state = 'menu';
if (QS.has('boss')) Game.start(QS.get('boss'), { skipIntro: QS.has('skipintro'), phase: +(QS.get('phase') || 0), nm: QS.has('nm') }); // ?nm=1: the nightmare version (does not touch the saved difficulty)
else Game.toMenu();
requestAnimationFrame(frame);
