# Изображения мастерской

## Восемь направлений лодки · 16 ноября 2026

Встроенный `imagegen`, референс — `src/art/boat-isometric.png`. Новый файл `C:/codex/fishing game/src/art/boat-directions.png`: прозрачный атлас 4 × 2, направления вправо, вниз-вправо, вниз, вниз-влево, влево, вверх-влево, вверх, вверх-вправо. Рыбак остаётся вертикальным при поворотах. `src/BoatCanvas.tsx` рисует ракурс, отдельные движущиеся вёсла и след в мировых координатах, который затухает за 3,6 секунды. При рисовании используется имеющийся в проекте фильтр `sprite-cutout` для чистого альфа-контура.

Промпт:

Create a production game sprite atlas using reference as exact boat and fisherman design. Transparent PNG, landscape 2:1 canvas. EXACTLY 8 equal SQUARE cells arranged 4 columns by 2 rows, no gaps between cells, no borders or labels. Each cell holds ONE full same small wooden fishing skiff at equal scale, centered at exact center of cell with generous transparent margins. Camera fixed isometric elevated 55 degrees looking down. ROTATE BOAT IN THE WATER PLANE, never rotate the whole picture; fisherman always upright with head toward top of image. No long fishing rod, no oars outside hull (animated oars added by code). Bow is pointed end, stern flat. Directions MUST be: top row left to right bow pointing SCREEN RIGHT, LOWER RIGHT, DOWN toward viewer, LOWER LEFT; bottom row left to right bow SCREEN LEFT, UPPER LEFT away from viewer, UP away from viewer, UPPER RIGHT. The same moss green jacket/brown hat fisherman seated center; hands holding oar grips at sides. Detailed painterly realist worn timber mossy swamp game look. Each boat spans about 72% cell width or height at most. True transparency everywhere around every boat. No water, shadows, floor, text, numbering, lines or extraneous items. All 8 boat views separate and fully visible, consistent overhead camera and light.

## Изометрическая акватория и лодка · 16 ноября 2026

Созданы встроенным `imagegen`. Игровые копии: `src/art/pond-isometric.png` и `src/art/boat-isometric.png`. Исходники сохранены в `C:/Users/Webpractik/.codex/generated_images/01a1e472-e46a-78e1-a898-83e91ee753c2/`. Фон, лодка, маршруты и поплавок используют общую систему координат; правила находятся в `shared/navigation.ts`. Прежние изображения не заменены.

Промпт фона:

Use case: stylized-concept. Asset type: background for a playable isometric swamp fishing game. Wide landscape 16:9 image. Camera: high elevated orthographic three-quarter top-down view at 55 degrees looking down, absolutely NO horizon or sky. Detailed painterly oil/gouache realism, moss green and deep teal water, muted golden afternoon light, weathered cypress trees and reeds. The entire central rectangle x12%-88%, y28%-77% MUST be navigable empty water without land or obstacles. Shoreline vegetation frames ONLY outermost edges, tall trees confined top 15% and left/right 8%. Three subtle fishing habitats on the water: a patch of floating lily pads at x28% y58%, a small mostly submerged old branch at x53% y38%, a dark teal deep water pool at x77% y57%. Keep these features small, mostly water, not islands. Underwater plants, gentle ripples, soft tree reflections with coherent elevated view. A tiny empty wooden landing pier enters from bottom-left corner and stops at x13% y79%. Beautiful hand-painted tactical adventure game environment, realistic natural materials, calm atmospheric depth. No boats, no people, no text, no labels, no UI, no grid, no borders. Full bleed environment, not a floating diorama.

Промпт лодки (прозрачный фон):

Use case: stylized-concept. A single small wooden fishing skiff with one seated fisherman wearing a moss green jacket and brown hat, viewed in ISOMETRIC ORTHOGRAPHIC three quarter from above, camera elevated 55 degrees. The bow points toward upper RIGHT, stern toward lower LEFT. Full boat entirely visible, occupies image with small margin. Long weathered timber hull, two cross benches, fishing creel, oars tucked inside, fisherman sits in center with hands together holding a short rod HANDLE ONLY (rod and line will be drawn in game). Beautiful detailed painterly oil/gouache realism, moss green paint and old warm wood, soft warm golden lighting, matching a natural swamp adventure game. Genuinely transparent background everywhere around silhouette, no water, no ground plane, no shadow outside boat, no border, no text. Landscape 3:2 composition. This is an elevated top-down game sprite, not eye-level side view.

## Встроенные объекты и выход

Причал использует `dock-integrated.png`, мастерская — `workshop-exit.png`. Оба изображения отредактированы встроенным imagegen. В причал вписаны заказ на пергаменте у воды, таблица с рыбами на стене и сундук со снастями. В мастерской добавлена открытая дверь слева. Зоны нажатия и световая подсветка привязаны к координатам иллюстраций.

Промпт причала

Use case: precise-object-edit. Edit the provided 16:9 fishing game dock painting into a finished cohesive point-and-click game environment. Preserve camera, landscape, swamp sunset, trees, water, pier geometry, wooden boat position and overall warm painterly realism. Integrate exactly three readable environmental interactable props naturally with matching perspective, weathering, contact shadows and lantern illumination. 1) Quest sign near water: on the outer LEFT end of the wooden pier around x53% y48%, one modest weathered sign on two posts fixed into deck boards, with a single large cream parchment fishing order and small wax seal, no roof, full legs visibly attached to pier. 2) Leaderboard: a distinct wide dark wooden framed chalkboard attached FLUSH to the cabin wall immediately RIGHT of the open doorway, around x88% y40%. Adjust that wall/window to fit this plaque clearly. Use small fish emblems and three rows of chalk tally marks, no legible names or letters, no duplicated parchment noticeboard. The open doorway remains clearly visible at x79% y45%. 3) Fishing tackle: a grounded wooden tackle chest, coiled line, brass reel and two rods leaning against the cabin near the right edge of the walkway, around x90% y67%, visibly resting on the planks. Keep props proportional, coherent and readable, integrated into the painting, no sticker cutouts or luminous outlines. No UI, buttons, labels, borders, arrows or text. Output a wide 16:9 landscape image, ideally 2560x1440.

Промпт мастерской

Use case: precise-object-edit. Edit this 16:9 painterly fishing workshop game interior. Add a clearly visible real OPEN EXIT DOOR on the LEFT wall, fully within the image roughly x6%-19%, y29%-78%. The sturdy weathered timber doorway shows the outdoor wooden dock, blue-green swamp water and warm dusk sky through it. Its threshold joins the interior floor naturally and is reachable, clear of the counter. Open wooden door leaf rests against the left wall, brass latch, perspective and shadows consistent with room. Make room by shortening/moving the merchant counter to x23%-43% and shelves to behind him. Keep the same friendly merchant in cap and apron behind that counter (center x30% y49%), with scale and fish basket. Preserve the large central window, aged beams, amber lantern lighting, right tackle workbench/rods/tools and foreground right boat as closely as possible. Keep the exit doorway visually distinct from the window, with a complete full-height opening down to the floor. A continuous polished adventure game painting, no collage, no UI or labels, no text or glowing outlines. Wide 16:9 image.



Созданы встроенным инструментом imagegen. Фон причала `dock.jpg` использован как референс стиля интерьера. Исходные генерации сохранены отдельно, проект использует оптимизированные копии.

- Интерьер: `C:/codex/fishing game/src/art/workshop.jpg`, 1920 × 1080.
- Снасти с прозрачным фоном: `C:/codex/fishing game/src/art/tackle.png`, ширина 400 px, сохранён альфа-канал.

## Промпт интерьера

Create a new 16:9 landscape game background showing the INTERIOR of the rustic fishing workshop seen in the reference (reference is style and world only). Painterly detailed oil/gouache realistic adventure game art, moss green shadows and warm amber lantern light, aged timber walls. Wide eye-level room. On the LEFT third centered x28% y55%, a friendly middle aged fish merchant wearing cap and apron stands behind a wooden counter with weighing scales and fish basket, readable silhouette. On RIGHT third centered x73% y57%, a distinct tackle workbench with fishing rods, reels, net and boat repair tools, visible separate silhouette. Center is open wooden floor, back window looks onto misty swamp. Room fills entire frame, objects clear and large. Leave upper 15% relatively quiet for game controls. No text, no interface, no borders, no lettering. This is a game location players click on objects.

## Промпт снастей

A single isolated game prop: rustic wooden fishing tackle box with two slender fishing rods leaning diagonally upward and a coiled fishing line and brass reel, small landing net behind it. Entire object visible with clear alpha silhouette, transparent background, no floor plane. Three quarter view, warm light from upper right, detailed realistic painterly gouache/oil game sprite, aged brown wood, moss green fabric and amber brass. Compact composition, box at bottom, rods rising above, no text or UI. Fits outside a swamp fishing lodge.

## Слои сцен и боя

Исходные иллюстрации `dock.jpg` и `workshop.jpg` сохранены как референсы. Игровые версии со встроенными объектами описаны выше. Зоны нажатия привязаны к кадру 16:9. На узком экране кнопки стоят под иллюстрацией.

Ниже приведены исходные запросы на дополнительные слои и изображения боя. Исходники находятся в `C:/Users/Webpractik/.codex/generated_images/01a1e3d2-4225-7292-b730-75a900e52892`. PNG рыб используется в бою, трюме и предпросмотре размещения.

| Файл | Содержание запроса |
| --- | --- |
| `C:/codex/fishing game/src/art/dock-base.jpg` | Убрать домик и лодку из исходного причала, сохранив пирс, воду, лес, свет и перспективу. |
| `C:/codex/fishing game/src/art/hut.png` | Выделить домик: крыша, дымоход, фонарь, окно, дверь, прикреплённая сеть и стол. Прозрачный фон без настила и пейзажа. |
| `C:/codex/fishing game/src/art/skiff.png` | Выделить деревянную лодку с полным корпусом, без воды и столбов, на прозрачном фоне. |
| `C:/codex/fishing game/src/art/noticeboard.png` | Деревянная доска объявлений на коротких стойках с небольшой крышей и листками пергамента, без читаемого текста, прозрачный фон, стиль рыбацкого причала. |
| `C:/codex/fishing game/src/art/room-base.jpg` | Удалить торговца, сохранив прилавок; убрать правый верстак, удочки и инструменты, сохранив помещение, окно, фонарь, сеть и лодку переднего плана. |
| `C:/codex/fishing game/src/art/merchant.png` | Выделить торговца от кепки до рук без прилавка на прозрачном фоне. |
| `C:/codex/fishing game/src/art/bench.png` | Выделить правый верстак с удочками, стойками, катушками, инструментами и ящиками без окружающего помещения. |
| `C:/codex/fishing game/src/art/duel-rod.png` | Руки в перчатках и зелёных рукавах от первого лица держат согнутую старинную удочку с латунной катушкой. Направление снизу слева вверх вправо, живописный реализм, прозрачный фон. |
| `C:/codex/fishing game/src/art/duel-fish.png` | Три равных квадратных секции в горизонтальном атласе 3:1: карась, окунь и щука, смотрящие влево, прозрачный фон. Последующее редактирование убирает белые и серые ореолы, сохраняя самих рыб. Итоговый атлас 1200 × 400. |

## Заставка боя

Портрет и надпись созданы встроенным ImageGen с прозрачным фоном. Заставка также использует существующие `pond.jpg` и `duel-fish.png`.

- `fight-angler.png` — Create a transparent PNG character portrait asset for the LEFT edge of a video game's fight intro. One rugged original swamp fisherman, waist-up, seen in three-quarter profile clearly facing RIGHT, looking intently at a fish offscreen. Dark moss-green worn oilskin coat, dented olive fishing hat, faded tobacco-brown fingerless leather gloves, hand gripping an antique bamboo fishing-rod handle with small bronze reel very close to his chest. Focus on the character’s face and upper body, silhouette fills most of the portrait. Keep full cap, head and shoulders and elbow in bounds; waist can naturally crop at bottom. Painterly detailed realistic gouache/oil rustic fishing adventure game art, expressive human weathered face, warm soft tungsten rim light from right, cool desaturated green shadows. Image is a cutout for compositing, preserve strong readable contours, genuinely transparent everywhere around character. No setting, no ground, no extra objects, no writing, no encircling effects. Portrait orientation.
- `fight-title.png` — Create one isolated typographic title asset for a retro fighting-game combat intro. Write precisely FIGHT, five capital letters F I G H T in one horizontal line. Make it feel like classic Mortal Kombat arcade FIGHT typography: original hand-cut slashing angular brush strokes, sharply tapered pointed ends, clean cohesive silhouette, very bold and legible at small scale with each character distinct, italic forward thrust. Dark crimson at the very tops of letters, bright saturated red upper third, vivid orange to molten golden yellow at the bottom tips, thin dark red keyline following the brush contours. Crisp strong strokes with restrained distressed cutouts, strong contrast, intense and fast. Center on an approximately wide 3:1 wordmark silhouette, fully in frame with a small safe margin around every letter. No shadows beyond the keyline, no sparks, no flames outside the letter shapes, no subtitle, no other text, no borders or background, genuinely transparent canvas. This will be composited over a dark pond scene.
## Деревянный стол экрана снастей

`tackle-table.jpg` — фон полноэкранных снастей на причале и в мастерской. Создан встроенным ImageGen, сохранён в проекте как JPEG. Затемнение и тени карт добавлены в `src/tackle.css`, чтобы текст оставался читаемым.

Промпт:

Use case: stylized-concept. Asset type: full-screen background texture for the equipment and deck-building screen of a rustic swamp fishing adventure game. Primary request: an old dark wooden fishing workshop tabletop seen straight from above, full bleed, wide landscape 16:9. Subject: just the table surface, broad horizontal weathered walnut and oak planks, fine natural wood grain, subtle knots, small scratches and worn edges along the seams, understated traces of use. Detailed painterly realistic oil/gouache game environment art, tactile matte wood, warm tobacco and umber browns, soft amber lantern light across the center and slightly darker corners. Moderate low contrast so cream interface text will read over the texture, but the wood should remain clearly recognizable. Flat orthographic top-down viewpoint, no perspective convergence, table fills entire image with no visible outer edge. Clear empty working surface everywhere. No objects, no tools, no fishing tackle, no cards, no paper, no hands, no writing, no lettering, no UI, no border, no watermark. Output ideally 2048x1152.

