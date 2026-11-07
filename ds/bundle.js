/* @ds-bundle: {"format":4,"namespace":"LilieVET","components":[{"name":"Button"},{"name":"Badge"},{"name":"VetCard"},{"name":"PetCard"},{"name":"Field"},{"name":"Chip"},{"name":"OptionCard"},{"name":"Notice"},{"name":"Steps"},{"name":"BillSummary"},{"name":"ChatBubble"},{"name":"TabBar"},{"name":"Character"},{"name":"CharacterNote"},{"name":"EmptyState"},{"name":"Sparks"},{"name":"IncomingRequest"},{"name":"TrackingCard"},{"name":"Toast"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;

  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(' ');
  }
  function omit(obj, keys) {
    var out = {};
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && keys.indexOf(k) < 0) out[k] = obj[k];
    return out;
  }
  function icon(path) {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, path);
  }
  var uidN = 0;
  function useId(given) {
    var ref = React.useRef(null);
    if (!ref.current) ref.current = given || 'lv-' + (++uidN);
    return given || ref.current;
  }

  /* Íconos de línea (trazo 2 px, puntas redondeadas), los mismos del prototipo */
  var PATHS = {
    home: 'M3.5 11 12 4l8.5 7|M5.5 9.5V20h13V9.5|M10 20v-5.5h4V20',
    paw: 'M8.3 17.2c.6-2.7 2-4.7 3.9-4.7s3.3 2 3.9 4.7c.4 1.6-.7 2.8-2.1 2.8-.8 0-1.2-.4-1.8-.4s-1 .4-1.8.4c-1.4 0-2.5-1.2-2.1-2.8z',
    plus: 'M12 5v14M5 12h14',
    cal: 'M3.5 10h17M8 3v4M16 3v4',
    user: 'M4.5 20c1.3-3.6 4.2-5.6 7.5-5.6s6.2 2 7.5 5.6',
    inbox: 'M4 13.5 6.6 6h10.8L20 13.5V19H4z|M4 13.5h4.5l1.2 2.2h4.6l1.2-2.2H20',
    route: 'M8.2 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.8',
    chat: 'M4 5.5h16v10.5H10l-4.5 3.8V16H4z|M8 9.5h8M8 12.5h5',
    check: 'M5 12.5 9.5 17 19 7.5',
    info: 'M12 11v5.5M12 7.8v.01',
    alert: 'M12 4 21 19.5H3z|M12 10v4.2M12 17v.01',
    dog: 'M7.5 5C5 5 3 6.6 3 9.6c0 2.2 1 3.6 2.2 3.6L7 11.2V15c0 3 2.2 5 5 5s5-2 5-5v-3.8l1.8 2c1.2 0 2.2-1.4 2.2-3.6C21 6.6 19 5 16.5 5z|M10 12.3v.01M14 12.3v.01M11 16.2h2',
    cat: 'M4.5 10V3.8l4.2 3.4h6.6l4.2-3.4V10c0 6.2-3.4 10-7.5 10s-7.5-3.8-7.5-10z|M9.5 12.4v.01M14.5 12.4v.01M11 15.5h2l-1 1z',
    pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z',
    clock: 'M12 7.5V12l3 2',
    wallet: 'M4 7.5h14.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V6.5A1.5 1.5 0 0 1 5.5 5H17|M16 13.5h.01'
  };
  var EXTRA = {
    paw: [['circle', { cx: 6.5, cy: 10, r: 1.7 }], ['circle', { cx: 10, cy: 6, r: 1.7 }], ['circle', { cx: 14.5, cy: 6, r: 1.7 }], ['circle', { cx: 18, cy: 10, r: 1.7 }]],
    cal: [['rect', { x: 3.5, y: 5, width: 17, height: 15.5, rx: 2.5 }]],
    user: [['circle', { cx: 12, cy: 8, r: 3.8 }]],
    route: [['circle', { cx: 6, cy: 19, r: 2.2 }], ['circle', { cx: 18, cy: 5, r: 2.2 }]],
    info: [['circle', { cx: 12, cy: 12, r: 8.5 }]],
    pin: [['circle', { cx: 12, cy: 10, r: 2.3 }]],
    clock: [['circle', { cx: 12, cy: 12, r: 8.5 }]]
  };
  function lineIcon(name, cls) {
    if (name && typeof name === 'object') return name;
    var d = PATHS[name] || '';
    var kids = (EXTRA[name] || []).map(function (e, i) { return h(e[0], Object.assign({ key: 'e' + i }, e[1])); });
    d.split('|').forEach(function (p, i) { if (p) kids.push(h('path', { key: 'p' + i, d: p })); });
    return h('svg', { className: cx('lv-i', cls), viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, kids);
  }
  function money(n) {
    var v = Math.abs(Number(n || 0));
    return (Number(n) < 0 ? '−' : '') + '$' + v.toLocaleString('es-MX', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }
  function amount(v) { return typeof v === 'number' ? money(v) : v; }

  /** Botón en forma de píldora. Una sola variante primary por pantalla. */
  function Button(props) {
    var variant = props.variant || 'primary';
    var size = props.size || 'md';
    var rest = omit(props, ['variant', 'size', 'block', 'className', 'children']);
    return h('button', Object.assign({ type: 'button' }, rest, {
      className: cx('lv-btn', 'lv-btn-' + variant, size === 'sm' && 'lv-btn-sm', props.block && 'lv-btn-block', props.className)
    }), props.children);
  }

  var BADGE_ICONS = {
    verificado: function () { return icon(h('path', { d: 'M5 12.5l4.5 4.5L19 7.5' })); },
    error: function () { return icon(h('g', null, h('path', { d: 'M12 7v6' }), h('path', { d: 'M12 17h.01' }))); },
    'en-camino': function () { return h('span', { className: 'lv-dot', 'aria-hidden': true }); },
    pendiente: function () { return h('span', { className: 'lv-dot lv-dot-accent', 'aria-hidden': true }); }
  };

  /** Etiqueta corta de estado. El tono siempre va con una palabra (y un ícono o punto en los estados). */
  function Badge(props) {
    var tone = props.tone || 'neutral';
    var ic = BADGE_ICONS[tone];
    return h('span', { className: cx('lv-badge', 'lv-badge-' + tone, props.className) }, ic ? ic() : null, props.children);
  }

  function initials(name) {
    var parts = String(name || '').replace(/^(Dra?\.|MVZ)\s+/i, '').split(/\s+/).filter(Boolean);
    return ((parts[0] || '')[0] || '').concat((parts[1] || '')[0] || '').toUpperCase();
  }

  /** Tarjeta de veterinario para listas y resultados de búsqueda. */
  function VetCard(props) {
    var avatar = h('div', { className: 'lv-avatar', 'aria-hidden': !props.photo }, props.photo ? h('img', { src: props.photo, alt: props.name }) : initials(props.name));
    var meta = [];
    if (props.rating != null) meta.push(h('span', { key: 'r' }, h('span', { className: 'lv-star', 'aria-hidden': true }, '★ '), h('b', null, String(props.rating)), props.reviews != null ? ' (' + props.reviews + ')' : null));
    if (props.eta) meta.push(h('span', { key: 'e' }, 'Llega en ', h('b', null, props.eta)));
    if (props.distance) meta.push(h('span', { key: 'd' }, 'a ', props.distance));
    return h('article', { className: cx('lv-card', props.className) },
      h('div', { className: 'lv-card-head' },
        avatar,
        h('div', null,
          h('h3', { className: 'lv-card-name' }, props.name),
          props.specialty ? h('p', { className: 'lv-card-sub' }, props.specialty) : null
        )
      ),
      props.verified ? h('div', null, h(Badge, { tone: 'verificado' }, 'Cédula verificada')) : null,
      meta.length ? h('div', { className: 'lv-card-meta' }, meta) : null,
      h('div', { className: 'lv-card-foot' },
        props.price ? h('div', { className: 'lv-price' }, props.price, h('small', null, props.priceNote || 'Consulta a domicilio')) : h('span'),
        h(Button, { size: 'sm', onClick: props.onRequest }, props.actionLabel || 'Pedir consulta')
      )
    );
  }

  /** Tarjeta de mascota: foto o ícono de especie, nombre, datos y hasta dos etiquetas. */
  function PetCard(props) {
    var cat = props.species === 'gato';
    var interactive = !!props.onClick;
    return h(interactive ? 'button' : 'article', Object.assign(interactive ? { type: 'button', onClick: props.onClick } : {}, { className: cx('lv-pet', interactive && 'lv-pet-btn', props.className) }),
      h('span', { className: cx('lv-pet-av', cat && 'lv-pet-av-cat'), 'aria-hidden': true }, props.photo ? h('img', { src: props.photo, alt: '' }) : lineIcon(cat ? 'cat' : 'dog')),
      h('span', { className: 'lv-pet-body' },
        h('span', { className: 'lv-pet-name' }, props.name),
        props.detail ? h('span', { className: 'lv-pet-detail' }, props.detail) : null,
        props.badges && props.badges.length ? h('span', { className: 'lv-pet-badges' }, props.badges.slice(0, 2).map(function (b, i) { return h(Badge, { key: i, tone: b.tone }, b.label); })) : null
      ),
      interactive ? h('svg', { className: 'lv-i lv-pet-chev', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: 'm9 5 7 7-7 7' })) : null
    );
  }

  /** Campo de formulario con etiqueta visible, ayuda y error. */
  function Field(props) {
    var id = useId(props.id);
    var as = props.as || 'input';
    var helpId = id + '-help';
    var rest = omit(props, ['label', 'hint', 'error', 'as', 'options', 'className', 'id']);
    var control;
    var common = Object.assign({}, rest, { id: id, className: cx('lv-in', props.error && 'lv-in-error'), 'aria-invalid': props.error ? true : undefined, 'aria-describedby': props.hint || props.error ? helpId : undefined });
    if (as === 'textarea') control = h('textarea', common);
    else if (as === 'select') control = h('select', common, (props.options || []).map(function (o) { var v = typeof o === 'object' ? o : { value: o, label: o }; return h('option', { key: v.value, value: v.value }, v.label); }));
    else control = h('input', Object.assign({ type: 'text' }, common));
    return h('div', { className: cx('lv-field', props.className) },
      h('label', { htmlFor: id }, props.label),
      control,
      props.error ? h('small', { id: helpId, className: 'lv-field-error' }, props.error) : props.hint ? h('small', { id: helpId }, props.hint) : null
    );
  }

  /** Chip seleccionable (casilla o radio) para síntomas, carácter, especie y filtros. */
  function Chip(props) {
    var rest = omit(props, ['tone', 'children', 'className', 'type', 'hint']);
    return h('label', { className: cx('lv-chip', props.tone === 'alerta' && 'lv-chip-alerta', props.className) },
      h('input', Object.assign({ type: props.type || 'checkbox' }, rest)),
      props.children,
      props.hint ? h('small', null, props.hint) : null
    );
  }

  /** Opción grande seleccionable (radio o casilla) con palomita: mascota, ventana de horario, servicio. */
  function OptionCard(props) {
    var rest = omit(props, ['title', 'description', 'leading', 'trailing', 'size', 'className', 'type']);
    return h('label', { className: cx('lv-opt', props.size === 'sm' && 'lv-opt-sm', props.disabled && 'lv-opt-off', props.className) },
      h('input', Object.assign({ type: props.type || 'radio' }, rest)),
      props.leading || null,
      h('span', { className: 'lv-opt-body' },
        h('strong', null, props.title),
        props.description ? h('span', null, props.description) : null
      ),
      props.trailing || null,
      h('span', { className: 'lv-tick', 'aria-hidden': true }, icon(h('path', { d: 'M5 12.5 9.5 17 19 7.5' })))
    );
  }

  var NOTICE_ICON = { aviso: 'alert', info: 'info', error: 'alert', exito: 'check' };
  /** Aviso en línea: siempre con ícono y una frase. aviso (naranja), info (lavanda), error (rojo), exito (verde). */
  function Notice(props) {
    var tone = props.tone || 'aviso';
    return h('div', { className: cx('lv-note', 'lv-note-' + tone, props.className), role: tone === 'error' ? 'alert' : undefined },
      lineIcon(NOTICE_ICON[tone] || 'info'),
      h('div', null, props.title ? h('strong', null, props.title, ' ') : null, props.children)
    );
  }

  /** Barra de avance de un asistente: "Paso 2 de 6 · Motivo". */
  function Steps(props) {
    var total = props.total || 1, current = Math.min(props.current || 1, total), bars = [];
    for (var i = 1; i <= total; i++) bars.push(h('i', { key: i, className: i <= current ? 'on' : undefined }));
    return h('div', { className: cx('lv-steps', props.className) },
      h('span', { className: 'lv-steps-label' }, 'Paso ' + current + ' de ' + total + (props.label ? ' · ' + props.label : '')),
      h('div', { className: 'lv-steps-bars', role: 'progressbar', 'aria-valuemin': 1, 'aria-valuemax': total, 'aria-valuenow': current }, bars)
    );
  }

  /** Desglose de un cobro: conceptos, total, descuentos, lo que se paga y el cashback. */
  function BillSummary(props) {
    var rows = (props.items || []).map(function (x, i) { return h('div', { key: 'i' + i, className: 'lv-bl' }, h('span', null, x.label), h('span', { className: 'lv-num' }, amount(x.amount))); });
    if (props.total != null) rows.push(h('div', { key: 't', className: 'lv-bl lv-bl-tot' }, h('b', null, props.totalLabel || 'Total'), h('b', { className: 'lv-num' }, amount(props.total))));
    (props.discounts || []).forEach(function (x, i) { rows.push(h('div', { key: 'd' + i, className: 'lv-bl lv-bl-ok' }, h('span', null, x.label), h('span', { className: 'lv-num' }, amount(typeof x.amount === 'number' ? -Math.abs(x.amount) : x.amount)))); });
    (props.notes || []).forEach(function (x, i) { rows.push(h('div', { key: 'n' + i, className: 'lv-bl lv-bl-muted' }, h('span', null, x.label), h('span', { className: 'lv-num' }, amount(x.amount)))); });
    if (props.payNow != null) rows.push(h('div', { key: 'p', className: 'lv-bl lv-bl-tot lv-bl-pay' }, h('b', null, props.payNowLabel || 'Pagas ahora'), h('b', { className: 'lv-num' }, amount(props.payNow))));
    if (props.cashback != null) rows.push(h('div', { key: 'c', className: 'lv-bl lv-bl-ok' }, h('span', null, props.cashbackLabel || 'Cashback para tu siguiente pago'), h('span', { className: 'lv-num' }, '+' + amount(props.cashback))));
    return h('div', { className: cx('lv-bill', props.className) }, rows);
  }

  /** Burbuja del chat entre tutor y MVZ. */
  function ChatBubble(props) {
    var me = props.from === 'me';
    return h('div', { className: cx('lv-msg', me ? 'lv-msg-me' : 'lv-msg-them', props.className) },
      props.image ? h('img', { className: 'lv-msg-img', src: props.image, alt: props.imageAlt || 'Foto enviada' }) : null,
      props.children ? h('p', null, props.children) : null,
      props.time || props.author ? h('span', { className: 'lv-msg-t' }, [props.author, props.time].filter(Boolean).join(' · ')) : null
    );
  }

  /** Barra inferior de navegación: 5 pestañas para pet parent (Agendar al centro), 4 para MVZ. */
  function TabBar(props) {
    var items = props.items || [];
    return h('nav', { className: cx('lv-tabbar', props.className), style: { gridTemplateColumns: 'repeat(' + items.length + ', 1fr)' }, 'aria-label': props.label || 'Secciones' },
      items.map(function (it) {
        var on = it.id === props.current;
        return h('button', { key: it.id, type: 'button', className: cx(it.featured && 'lv-tab-featured'), 'aria-current': on ? 'page' : undefined, onClick: props.onSelect ? function () { props.onSelect(it.id); } : undefined },
          h('span', { className: 'lv-tab-ico' }, lineIcon(it.icon), it.badge ? h('span', { className: 'lv-tab-badge', 'aria-label': it.badge + ' pendientes' }, it.badge > 9 ? '9+' : String(it.badge)) : null),
          it.label
        );
      })
    );
  }

  /* ───────── Personalidad: Liebe, Lilie y las chispas ───────── */

  /* Dibujos estilo sticker (contorno en tinta, rellenos de marca). Colores en bundle.css (.lv-ch-*), fijos en los dos temas. */
  var CHARS = {
    liebe:
      '<path class="lv-ch-lav lv-ch-ol" d="M18 50 Q32 56 46 50 L33.6 62.4 Q32 64 30.4 62.4 Z"/>' +
      '<g class="lv-ch-oreja"><path class="lv-ch-ciruela lv-ch-ol" d="M14 31 C9 22 9.5 11 15 7.5 C20 8 26 14 29.5 20.5 Z"/><path class="lv-ch-blanco" d="M16.5 25 C14 19 14.5 13 17 11.5 C20 13 23 16.5 25 20.5 Z"/></g>' +
      '<path class="lv-ch-ciruela lv-ch-ol" d="M50 31 C55 22 54.5 11 49 7.5 C44 8 38 14 34.5 20.5 Z"/><path class="lv-ch-blanco" d="M47.5 25 C50 19 49.5 13 47 11.5 C44 13 41 16.5 39 20.5 Z"/>' +
      '<path class="lv-ch-rosa lv-ch-ol" d="M32 16 C45 16 52 25 52 36 C52 47 43 55 32 55 C21 55 12 47 12 36 C12 25 19 16 32 16 Z"/>' +
      '<path class="lv-ch-blanco" d="M32 32 C38 32 44 38 44 45.5 C44 51.5 38.5 55 32 55 C25.5 55 20 51.5 20 45.5 C20 38 26 32 32 32 Z"/>' +
      '<path class="lv-ch-ciruela" d="M18.5 30.5 C19 27 22.5 25.5 26 27 C28 29 27 33 24 34 C21 34.5 18.5 33 18.5 30.5 Z"/>' +
      '<g class="lv-ch-ojos"><circle class="lv-ch-ink" cx="24" cy="33.5" r="2.9"/><circle class="lv-ch-ink" cx="40" cy="33.5" r="2.9"/><circle class="lv-ch-blanco" cx="25" cy="32.4" r="0.95"/><circle class="lv-ch-blanco" cx="41" cy="32.4" r="0.95"/></g>' +
      '<path class="lv-ch-rosa lv-ch-ol2" d="M29.6 47 C29.6 51.2 34.4 51.2 34.4 47 Z"/>' +
      '<path class="lv-ch-line" d="M32 43.4 V45.6 M32 45.6 C30.6 48.2 27.6 48.2 26.4 46.2 M32 45.6 C33.4 48.2 36.4 48.2 37.6 46.2"/>' +
      '<path class="lv-ch-ink" d="M28.4 40.4 C28.4 38.8 35.6 38.8 35.6 40.4 C35.6 42.2 33.6 43.6 32 43.6 C30.4 43.6 28.4 42.2 28.4 40.4 Z"/>',
    lilie:
      '<path class="lv-ch-lav lv-ch-ol" d="M12 40 C12 29 13.5 20 16 10 L27.5 20.5 C30.5 19.8 33.5 19.8 36.5 20.5 L48 10 C50.5 20 52 29 52 40 C52 50.5 43 57 32 57 C21 57 12 50.5 12 40 Z"/>' +
      '<path class="lv-ch-rosa" d="M17.8 15.8 L24.6 21.9 L18.8 25.4 Z"/>' +
      '<path class="lv-ch-rosa" d="M46.2 15.8 L39.4 21.9 L45.2 25.4 Z"/>' +
      '<ellipse class="lv-ch-blanco" cx="32" cy="47.2" rx="9.2" ry="6.6"/>' +
      '<g class="lv-ch-ojos"><path class="lv-ch-ink" d="M21 38.2 C21.8 35.4 27.2 35.4 28 38.2 C27.2 40.6 21.8 40.6 21 38.2 Z"/><path class="lv-ch-ink" d="M36 38.2 C36.8 35.4 42.2 35.4 43 38.2 C42.2 40.6 36.8 40.6 36 38.2 Z"/><circle class="lv-ch-blanco" cx="25.6" cy="37.3" r="0.9"/><circle class="lv-ch-blanco" cx="40.6" cy="37.3" r="0.9"/></g>' +
      '<path class="lv-ch-line lv-ch-fino" d="M22.5 46 L10.5 44.2 M22.5 49 L11 50.6 M41.5 46 L53.5 44.2 M41.5 49 L53 50.6"/>' +
      '<path class="lv-ch-line" d="M32 45.6 V47.2 M32 47.2 C31 49.2 28.6 49.2 27.8 47.8 M32 47.2 C33 49.2 35.4 49.2 36.2 47.8"/>' +
      '<path class="lv-ch-rosa lv-ch-ol2" d="M29.5 43.2 H34.5 L32 45.8 Z"/>' +
      '<g transform="translate(46.5 23)"><g class="lv-ch-flor">' +
        '<ellipse class="lv-ch-blanco lv-ch-ol2" cx="0" cy="-4.2" rx="2.7" ry="4.5"/>' +
        '<ellipse class="lv-ch-blanco lv-ch-ol2" cx="0" cy="-4.2" rx="2.7" ry="4.5" transform="rotate(120)"/>' +
        '<ellipse class="lv-ch-blanco lv-ch-ol2" cx="0" cy="-4.2" rx="2.7" ry="4.5" transform="rotate(240)"/>' +
        '<circle class="lv-ch-nar lv-ch-ol2" cx="0" cy="0" r="2.2"/>' +
      '</g></g>'
  };
  var CHAR_NAMES = { liebe: 'Liebe', lilie: 'Lilie' };

  /** Liebe (perro mestizo rosa, cuida y acompaña) o Lilie (gata lavanda, da datos y recordatorios). Solo del lado del pet parent. 'lili' sigue funcionando como alias de 'lilie'. */
  function Character(props) {
    var who = CHARS[props.who] ? props.who : props.who === 'lili' ? 'lilie' : 'liebe';
    var size = props.size || 56;
    var anim = props.animate !== false;
    var label = props.label;
    var art = h('span', {
      className: cx('lv-ch', 'lv-ch-' + who, anim && 'lv-ch-anim', !props.sticker && props.className),
      style: { width: size, height: size },
      role: label ? 'img' : undefined,
      'aria-label': label || undefined,
      'aria-hidden': label ? undefined : true,
      dangerouslySetInnerHTML: { __html: '<svg viewBox="0 0 64 64" width="100%" height="100%" focusable="false">' + CHARS[who] + '</svg>' }
    });
    if (!props.sticker) return art;
    /* v3: sticker blanco con sombra sólida de tinta; aparece con un rebote corto */
    var box = Math.round(size * 1.32);
    return h('span', { className: cx('lv-ch-tile', anim && 'lv-ch-pop', props.className), style: { width: box, height: box } }, art);
  }

  var SPARKS_SVG =
    '<svg viewBox="0 0 48 48" width="100%" height="100%" focusable="false"><g transform="translate(5 43)">' +
    '<g transform="rotate(-86)"><rect class="lv-sp lv-sp-1" x="14" y="-3.6" width="16" height="7.2" rx="3.6"/></g>' +
    '<g transform="rotate(-46)"><rect class="lv-sp lv-sp-2" x="14" y="-3.6" width="16" height="7.2" rx="3.6"/></g>' +
    '<g transform="rotate(-6)"><rect class="lv-sp lv-sp-3" x="14" y="-3.6" width="16" height="7.2" rx="3.6"/></g>' +
    '</g></svg>';

  /** Las chispas del logo: tres pastillas naranjas que salen una sola vez. Solo en "consulta aceptada" (MVZ) y "cartilla al día". */
  function Sparks(props) {
    var size = props.size || 32;
    return h('span', {
      className: cx('lv-sparks', props.play !== false && 'lv-sparks-play', props.flip && 'lv-sparks-flip', props.className),
      style: { width: size, height: size },
      'aria-hidden': true,
      dangerouslySetInnerHTML: { __html: SPARKS_SVG }
    });
  }

  /** Globo de Liebe o Lilie: un recordatorio o una bienvenida, en primera persona y sin emojis. */
  function CharacterNote(props) {
    var who = props.who === 'lilie' || props.who === 'lili' ? 'lilie' : 'liebe';
    return h('div', { className: cx('lv-cnote', 'lv-cnote-' + who, props.className) },
      h(Character, { who: who, size: props.size || 40, animate: props.animate, sticker: props.sticker !== false }),
      h('div', { className: 'lv-cnote-bubble' },
        h('span', { className: 'lv-cnote-name' }, CHAR_NAMES[who]),
        props.title ? h('strong', { className: 'lv-cnote-title' }, props.title) : null,
        h('p', null, props.children),
        props.action ? h('div', { className: 'lv-cnote-act' }, props.action) : null
      )
    );
  }

  /** Estado vacío: Liebe (o los dos en la bienvenida), un título, una frase y una sola acción. */
  function EmptyState(props) {
    var who = props.who || 'liebe';
    var size = props.size || (who === 'ambos' ? 72 : 80);
    var art = who === 'ambos'
      ? [h(Character, { key: 'a', who: 'liebe', size: size, animate: props.animate, sticker: true }), h(Character, { key: 'b', who: 'lilie', size: Math.round(size * 0.92), animate: props.animate, sticker: true })]
      : h(Character, { who: who, size: size, animate: props.animate, sticker: true });
    return h('section', { className: cx('lv-empty', props.className) },
      h('div', { className: 'lv-empty-art' }, art),
      h('h2', { className: 'lv-empty-title' }, props.title),
      props.children ? h('p', { className: 'lv-empty-text' }, props.children) : null,
      props.action ? h('div', { className: 'lv-empty-act' }, props.action) : null
    );
  }

  /* ───────── Consulta en curso (sin personajes) ───────── */

  function clock(s) {
    s = Math.max(0, Math.round(s));
    var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  /** Solicitud entrante del lado del MVZ: datos, lo que gana y un tiempo para responder. Chispas al aceptar. */
  function IncomingRequest(props) {
    var total = props.seconds || 60;
    var ls = React.useState(props.secondsLeft != null ? props.secondsLeft : total), left = ls[0], setLeft = ls[1];
    var as = React.useState(props.status || 'nueva'), status = as[0], setStatus = as[1];
    React.useEffect(function () { if (props.status) setStatus(props.status); }, [props.status]);
    React.useEffect(function () {
      if (status !== 'nueva' || props.paused) return undefined;
      if (left <= 0) { setStatus('vencida'); return undefined; }
      var t = setTimeout(function () { setLeft(left - 1); }, 1000);
      return function () { clearTimeout(t); };
    }, [left, status, props.paused]);
    var pct = Math.max(0, Math.min(100, (left / total) * 100));
    var rows = [];
    if (props.distance) rows.push(h('div', { key: 'd', className: 'lv-req-row' }, lineIcon('pin'), h('span', null, props.distance)));
    if (props.window) rows.push(h('div', { key: 'w', className: 'lv-req-row' }, lineIcon('clock'), h('span', null, props.window)));
    if (props.earnings != null) rows.push(h('div', { key: 'e', className: 'lv-req-row lv-req-earn' }, lineIcon('wallet'), h('span', null, 'Ganas ', h('b', { className: 'lv-num' }, amount(props.earnings)))));
    var body;
    if (status === 'aceptada') {
      body = h('div', { className: 'lv-req-ok', role: 'status' },
        h(Sparks, { size: 40 }),
        h('div', null, h('strong', null, props.acceptedTitle || 'Aceptaste la consulta.'), props.acceptedText ? h('p', null, props.acceptedText) : null)
      );
    } else if (status === 'vencida') {
      body = h('p', { className: 'lv-req-late' }, props.expiredText || 'Se acabó el tiempo. La enviamos a otro MVZ.');
    } else {
      body = h('div', { className: 'lv-req-foot' },
        h(Button, { variant: 'secondary', size: 'sm', onClick: function () { setStatus('rechazada'); if (props.onDecline) props.onDecline(); } }, 'Rechazar'),
        h(Button, { size: 'sm', onClick: function () { setStatus('aceptada'); if (props.onAccept) props.onAccept(); } }, props.acceptLabel || 'Aceptar consulta')
      );
    }
    if (status === 'rechazada') body = h('p', { className: 'lv-req-late' }, 'La rechazaste. Te avisamos cuando llegue otra.');
    return h('article', { className: cx('lv-req', 'lv-req-' + status, props.className) },
      h('div', { className: 'lv-req-head' },
        status === 'aceptada' ? h(Badge, { tone: 'verificado' }, 'Aceptada') : h(Badge, { tone: status === 'nueva' ? 'nuevo' : 'neutral' }, status === 'nueva' ? 'Nueva' : status === 'vencida' ? 'Vencida' : 'Rechazada'),
        status === 'nueva' ? h('span', { className: cx('lv-req-timer', left <= 10 && 'lv-req-timer-low'), 'aria-live': left <= 10 ? 'polite' : undefined }, 'Responde en ', h('b', { className: 'lv-num' }, clock(left))) : null
      ),
      status === 'nueva' ? h('div', { className: 'lv-req-bar', 'aria-hidden': true }, h('i', { style: { width: pct + '%' } })) : null,
      h('div', { className: 'lv-req-main' },
        h('span', { className: cx('lv-pet-av', props.species === 'gato' && 'lv-pet-av-cat', 'lv-req-av'), 'aria-hidden': true }, lineIcon(props.species === 'gato' ? 'cat' : 'dog')),
        h('div', null,
          h('h3', { className: 'lv-req-title' }, props.title),
          props.detail ? h('p', { className: 'lv-req-detail' }, props.detail) : null
        )
      ),
      rows.length ? h('div', { className: 'lv-req-rows' }, rows) : null,
      body
    );
  }

  var TRACK_STEPS = [
    { id: 'asignada', label: 'Asignada' },
    { id: 'en-camino', label: 'En camino' },
    { id: 'llego', label: 'Llegó' }
  ];
  /** Seguimiento de la consulta del día: quién va, cuánto falta y en qué paso va. */
  function TrackingCard(props) {
    var stage = props.stage || 'en-camino';
    var idx = Math.max(0, TRACK_STEPS.map(function (s) { return s.id; }).indexOf(stage));
    var badge = stage === 'llego' ? h(Badge, { tone: 'verificado' }, 'Llegó') : stage === 'asignada' ? h(Badge, null, 'Asignada') : h(Badge, { tone: 'en-camino' }, 'En camino');
    var headline = stage === 'llego' ? (props.arrivedText || 'Ya está en tu puerta.') : stage === 'asignada' ? (props.window || '') : 'Llega en ' + (props.eta || '—');
    return h('article', { className: cx('lv-track', props.className) },
      h('div', { className: 'lv-track-head' },
        h('div', { className: 'lv-avatar lv-track-av', 'aria-hidden': !props.photo }, props.photo ? h('img', { src: props.photo, alt: props.vetName }) : initials(props.vetName)),
        h('div', { className: 'lv-track-who' },
          h('strong', null, props.vetName),
          props.subtitle ? h('span', null, props.subtitle) : null
        ),
        badge
      ),
      h('p', { className: 'lv-track-eta' }, h('b', null, headline), stage === 'en-camino' && props.distance ? h('span', null, ' · a ' + props.distance) : null),
      h('ol', { className: 'lv-track-steps', 'aria-label': 'Avance de la consulta' },
        TRACK_STEPS.map(function (s, i) {
          return h('li', { key: s.id, className: cx(i < idx && 'done', i === idx && 'now'), 'aria-current': i === idx ? 'step' : undefined }, h('i', { 'aria-hidden': true }), s.label);
        })
      ),
      props.note ? h('p', { className: 'lv-track-note' }, props.note) : null,
      props.action ? h('div', { className: 'lv-track-act' }, props.action) : null
    );
  }

  /** Aviso breve que aparece abajo y se va solo: confirma algo que ya pasó. Nunca para errores. */
  function Toast(props) {
    if (props.visible === false) return null;
    var lead = props.sparks ? h(Sparks, { size: 28 }) : lineIcon(props.tone === 'info' ? 'info' : 'check', 'lv-toast-i');
    return h('div', { className: cx('lv-toast', props.className), role: 'status', 'aria-live': 'polite' },
      lead,
      h('span', { className: 'lv-toast-text' }, props.children),
      props.actionLabel ? h('button', { type: 'button', className: 'lv-toast-act', onClick: props.onAction }, props.actionLabel) : null
    );
  }

  window.LilieVET = { Button: Button, Badge: Badge, VetCard: VetCard, PetCard: PetCard, Field: Field, Chip: Chip, OptionCard: OptionCard, Notice: Notice, Steps: Steps, BillSummary: BillSummary, ChatBubble: ChatBubble, TabBar: TabBar, Character: Character, CharacterNote: CharacterNote, EmptyState: EmptyState, Sparks: Sparks, IncomingRequest: IncomingRequest, TrackingCard: TrackingCard, Toast: Toast, money: money };
})();
