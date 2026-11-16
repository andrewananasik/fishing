# Разные акватории · 16 ноября 2026

Три фона созданы встроенным imagegen. Референс стиля и камеры: `pond-isometric.png`, который остался фоном «Края камышей». Новые игровые файлы: `pond-bend.png`, `pond-deep.png`, `pond-channel.png`. Координаты участков и старт лодки задаются в `shared/navigation.ts`; они общие для клиента и сервера. Координаты уточнены по готовым изображениям.

## Общая часть промпта

Use case: stylized-concept. Create one finished landscape 16:9 background for a playable swamp fishing game. Reference image is STYLE AND CAMERA ONLY; create a visibly different geography. Detailed painterly oil/gouache realism, natural worn materials. High elevated orthographic camera 55 degrees down, absolutely NO horizon or sky. Full bleed, no UI/text/labels/boats/people/grid. IMPORTANT: entire rectangle x13%-87%, y28%-77% must remain navigable water, no land or emergent solid obstacles inside it. Any habitat features inside it are submerged, boat-passable. Top 20% quiet enough for overlaid title. 

## Поворот протоки — pond-bend.png

Location: winding river bend in warm copper autumn light. River enters upper right and turns toward bottom left, long curling current streaks. Golden willow canopy and ochre reed banks confined to outer edges, not the cypress-wall composition of reference. Three small readable habitats at exact image coordinates: submerged reed/lily patch x72% y60%; a mostly sunken long timber x34% y43%; dark eddy x62% y32%. Tiny weathered landing enters bottom-left and ends x13% y79%. Warm green bronze water, beautiful visible sweeping river bend.

## Глубокая заводь — pond-deep.png

Location: broad deep forest pool in cool misty blue dawn. Rocky slate bank along leftmost edge, ancient roots and pale silver birch trunks top edge, open dark petrol blue basin. Three readable submerged habitats at exact coordinates: pale stony shallow shelf x27% y36%; sharp underwater rock shelf dropoff x72% y40%; large deep blue circular hole x49% y63%. These features must be navigable water with submerged stones only. Tiny old landing bottom RIGHT ends x88% y79%, no landing on left. Soft mist confined uppermost edge, clear central water. Clearly distinct from golden green cypress pond.

## Узкий проход — pond-channel.png

Location: narrow reed-lined passage, long parallel banks of very tall golden cattails at outer left/right edges, water runs from top center toward bottom center. Open continuous central navigation area x13%-87%, y28%-77%, banks NEVER intrude into this rectangle. Olive tea-brown shallow water toward edges with a winding dark teal central current, cooler overcast light. Three small readable submerged habitats at exact coordinates: sandy shallow x32% y62%; calm oval water reach x68% y51%; deep current channel x47% y31%. Tiny rough plank landing bottom-left ends x13% y79%. No cypress tree wall, no lily patch or branch matching reference. Strong vertical passage composition.
