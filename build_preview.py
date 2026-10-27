"""미리보기용 단일 HTML 만들기 (체험 모드). 실제 배포에는 index.html 과 폴더를 그대로 쓰면 됩니다."""
import pathlib, re, sys

root = pathlib.Path(__file__).parent
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'dist' / 'index.html'
html = (root / 'index.html').read_text(encoding='utf-8')
head = re.search(r'<!--HEAD-START-->(.*?)<!--HEAD-END-->', html, re.S).group(1)
body = re.search(r'<!--BODY-START-->(.*?)<!--BODY-END-->', html, re.S).group(1)
css = (root / 'css/style.css').read_text(encoding='utf-8')
scripts = ['js/config.js', 'games/common/shared.js', 'avatar/avatar.js', 'js/gamehub.js', 'games/puzzle/blocks/settings.js', 'games/puzzle/blocks/game.js', 'games/puzzle/battle/settings.js', 'games/puzzle/battle/game.js', 'games/puzzle/2048/settings.js', 'games/puzzle/2048/game.js', 'games/arcade/snake/settings.js', 'games/arcade/snake/game.js', 'js/shop.js', 'js/app.js', 'js/pwa.js']
js = '\n'.join(f'<script>\n{(root / s).read_text(encoding="utf-8")}\n</script>' for s in scripts)
page = f'''<title>gogo?gogo!</title>
<meta name="claude:viewport-fit-sides" content="cover">
{head.strip()}
<style>
{css}
</style>
{body.strip()}
{js}
'''
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(page, encoding='utf-8')
print(out, len(page))
