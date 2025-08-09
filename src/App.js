import React, { useEffect, useMemo, useRef, useState, useLayoutEffect, useCallback } from 'react';
import './App.css';

/** ---------- Константы и утилиты ---------- */

const SIZES = [
  '80x190','85x195','80x200','90x200','100x200',
  '120x200','140x200','160x200','180x200','200x200'
];
const HEIGHTS = [10, 20, 30]; // см

const sizeKind = s => +s.split('x')[0] >= 160 ? 'double' : 'single';
const visibleLayerKeys = {
  10: ['sloj-odin'],
  20: ['sloj-odin', 'sloj-dva'],
  30: ['sloj-odin', 'sloj-dva', 'sloj-tri'],
};

const LAYER_TITLES = {
  'sloj-odin': 'Слой 1',
  'sloj-dva': 'Слой 2',
  'sloj-tri': 'Слой 3',
  'potah': 'Чехол',
};

const useIsMobile = (bp = 768) => {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= bp : false));
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= bp);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [bp]);
  return isMobile;
};

/** Текст с ручными переносами: поддержка '\n' и '|' */
const formatLabel = (s) => {
  if (!s) return null;
  const parts = String(s).split(/\n|\|/g);
  return parts.map((p, i) => (
    <React.Fragment key={i}>
      {p.trim()}
      {i < parts.length - 1 ? <br/> : null}
    </React.Fragment>
  ));
};

/** Определение оптимального количества колонок для опций */
const getOptimalColumns = (containerWidth, isMobile, baseColumns) => {
  if (isMobile) {
    // На мобильных устройствах
    if (containerWidth < 320) return 4;
    if (containerWidth < 375) return 5;
    if (containerWidth < 480) return 5;
    return 5;
  } else {
    // На десктопе
    if (containerWidth < 200) return 2;
    if (containerWidth < 250) return 3;
    return baseColumns;
  }
};

/** Группа опций */
const OptionGroup = ({ title, options, name, selectedId, onChange, columnsDesktop = 3, columnsMobile = 5 }) => {
  const isMobile = useIsMobile();
  const containerRef = useRef(null);
  const [actualColumns, setActualColumns] = useState(isMobile ? columnsMobile : columnsDesktop);

  useEffect(() => {
    const updateColumns = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const cols = getOptimalColumns(width, isMobile, columnsDesktop);
        setActualColumns(cols);
      }
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);

    const resizeObserver = new ResizeObserver(updateColumns);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateColumns);
      resizeObserver.disconnect();
    };
  }, [isMobile, columnsDesktop]);

  return (
    <section className="layer-selector" ref={containerRef}>
      <h3 className="layer-title">{title}</h3>
      <div
        className="layer-options"
        style={{
          gridTemplateColumns: `repeat(${actualColumns}, minmax(0,1fr))`,
        }}
      >
        {options.map((opt) => {
          const img = opt.icon || opt.image;
          return (
            <label key={opt.id} className="layer-option">
              <input
                type="radio"
                name={name}
                value={opt.id}
                checked={selectedId === opt.id}
                onChange={() => onChange(name, opt.id)}
              />
              <div className="option-card">
                {img ? (
                  <img
                    src={img}
                    alt={opt.name}
                    className="option-image"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : <div className="image-placeholder" aria-hidden="true"/>}
                <span className="option-name">{formatLabel(opt.name)}</span>
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
};

/** ---------- Основной компонент ---------- */

const App = () => {
  const [configData, setConfigData] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({
    'sloj-odin': null,
    'sloj-dva': null,
    'sloj-tri': null,
    'potah': null,
  });
  const [selectedSize, setSelectedSize] = useState(SIZES[0]);
  const [selectedHeight, setSelectedHeight] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isMobile = useIsMobile();
  const [showPinnedMattress, setShowPinnedMattress] = useState(true);
  const priceCalcRef = useRef(null);
  const selectorsTopRef = useRef(null);
  const appRootRef = useRef(null);

  // Глобальная, единая высота карточек по всей странице
  const [globalCardHeight, setGlobalCardHeight] = useState(56);

  useEffect(() => {
    setShowPinnedMattress(isMobile);
  }, [isMobile]);

  // Загрузка конфигурации
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch('/data/layers-config.json');
        if (!res.ok) throw new Error('Failed to load configuration');
        const data = await res.json();
        if (cancelled) return;

        setConfigData(data);
        setSelectedOptions({
          'sloj-odin': data.mattressLayers[0]?.id || null,
          'sloj-dva': data.mattressLayers[0]?.id || null,
          'sloj-tri': data.mattressLayers[0]?.id || null,
          'potah': data.covers[0]?.id || null,
        });
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError('Ошибка загрузки конфигурации');
          setLoading(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Получение данных выбранного элемента (мемо)
  const getSelectedItemData = useCallback((layerKey, itemId) => {
    if (!configData) return null;
    if (layerKey === 'potah') return configData.covers.find(c => c.id === itemId) || null;
    return configData.mattressLayers.find(l => l.id === itemId) || null;
  }, [configData]);

  /** Стабильный пересчёт: берём высоту ТЕКСТА и добавляем «базу» (картинка + отступы) */
  const recalcGlobalCardHeight = () => {
    const nameEls = Array.from(document.querySelectorAll('.option-card .option-name'));
    if (!nameEls.length) return;

    // Определяем размеры элементов в зависимости от ширины экрана
    const screenWidth = window.innerWidth;
    let imageH, gap, paddingTopBottom, border;

    if (screenWidth <= 480) {
      imageH = 28;
      gap = 6;
      paddingTopBottom = 12;
      border = 4;
    } else if (screenWidth <= 768) {
      imageH = 32;
      gap = 6;
      paddingTopBottom = 12;
      border = 4;
    } else {
      imageH = 40;
      gap = 6;
      paddingTopBottom = 12;
      border = 4;
    }

    const base = imageH + gap + paddingTopBottom + border;

    let maxText = 0;
    nameEls.forEach(el => {
      maxText = Math.max(maxText, el.scrollHeight);
    });

    const next = Math.max(48, Math.ceil(base + maxText));
    setGlobalCardHeight(next);
  };

  // Пересчёт при изменениях
  useLayoutEffect(() => {
    recalcGlobalCardHeight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configData, selectedOptions, selectedHeight, isMobile]);

  // Ресайз/полная загрузка, догрузка картинок и изменение размеров контейнера
  useEffect(() => {
    const onResizeOrLoad = () => recalcGlobalCardHeight();
    window.addEventListener('resize', onResizeOrLoad);
    window.addEventListener('load', onResizeOrLoad);

    const imgs = Array.from(document.querySelectorAll('.option-image'));
    imgs.forEach(img => img.addEventListener('load', onResizeOrLoad));

    const ro = new ResizeObserver(() => recalcGlobalCardHeight());
    if (appRootRef.current) ro.observe(appRootRef.current);

    // Дополнительный таймер для корректировки после полной загрузки
    const timer = setTimeout(() => recalcGlobalCardHeight(), 500);

    return () => {
      window.removeEventListener('resize', onResizeOrLoad);
      window.removeEventListener('load', onResizeOrLoad);
      imgs.forEach(img => img.removeEventListener('load', onResizeOrLoad));
      ro.disconnect();
      clearTimeout(timer);
    };
  }, []);

  // Итоговая цена
  const totalPrice = useMemo(() => {
    if (!configData) return 0;
    let total = 0;
    for (const key of visibleLayerKeys[selectedHeight]) {
      const id = selectedOptions[key];
      const item = getSelectedItemData(key, id);
      if (item) total += item.price || 0;
    }
    const cover = getSelectedItemData('potah', selectedOptions['potah']);
    if (cover) total += cover.price || 0;
    return total;
  }, [getSelectedItemData, configData, selectedOptions, selectedHeight]);

  const handleOptionChange = (layerKey, itemId) => {
    setSelectedOptions(prev => ({ ...prev, [layerKey]: itemId }));
  };

  const handleAddToCart = () => {
    if (!configData) return;

    const getName = (key) => getSelectedItemData(key, selectedOptions[key])?.name || '';
    const name = `Матрас ${selectedSize}, ${selectedHeight}см — ${getName('sloj-odin')} + ${getName('sloj-dva')} + ${getName('sloj-tri')} | Чехол: ${getName('potah')}`;

    const data = {
      name,
      price: totalPrice,
      configuration: {
        layer1: getName('sloj-odin'),
        layer2: getName('sloj-dva'),
        layer3: getName('sloj-tri'),
        cover: getName('potah'),
        size: selectedSize,
        height: `${selectedHeight} см`,
      }
    };

    console.log('Product added to cart:', data);
    alert(`Товар добавлен в корзину:\n${name}\nЦена: ${totalPrice.toLocaleString('ru-RU')} Kč`);
  };

  const scrollToDetails = () => {
    const target = priceCalcRef.current || selectorsTopRef.current;
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return <div className="app-root loading-screen">Загрузка конфигуратора...</div>;
  }
  if (error || !configData) {
    return <div className="app-root error-screen">{error || 'Ошибка загрузки'}</div>;
  }

  const visibleKeys = visibleLayerKeys[selectedHeight];
  const pinnedActive = isMobile && showPinnedMattress;

  return (
    <div
      ref={appRootRef}
      className={`app-root ${pinnedActive ? 'with-pinned' : ''}`}
      style={{ "--global-card-min-height": `${globalCardHeight}px` }}
    >
      {/* Фиксированная визуализация матраса (мобильные, по умолчанию включено) */}
      {pinnedActive && (
        <div className="pinned-mattress" aria-live="polite">
          <div className="pinned-layers">
            <img
              src={`/layers/${selectedHeight}/${sizeKind(selectedSize)}/frame.webp`}
              alt="Каркас матраса"
              className="mattress-layer pinned-frame"
              style={{ zIndex: 100 }}
            />
            {visibleKeys.map((layerKey, index) => {
              const selectedItem = getSelectedItemData(layerKey, selectedOptions[layerKey]);
              if (!selectedItem) return null;
              const zIndexMap = { 'sloj-odin': 1, 'sloj-dva': 10, 'sloj-tri': 2 };
              return (
                <img
                  key={layerKey}
                  src={`/layers/${selectedHeight}/${sizeKind(selectedSize)}/${layerKey}/${selectedItem.slug}.webp`}
                  alt={selectedItem.name}
                  className={`mattress-layer layer-${index + 1}`}
                  style={{ zIndex: zIndexMap[layerKey] }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Контент */}
      <div className="layout">
        {/* Визуализация для десктопа (обычная, не фиксированная) */}
        <div className="visual" aria-hidden={pinnedActive}>
          <div className="layers-canvas">
            <img
              src={`/layers/${selectedHeight}/${sizeKind(selectedSize)}/frame.webp`}
              alt="Каркас матраса"
              className="mattress-layer layer-frame"
              style={{ zIndex: 100 }}
            />
            {visibleKeys.map((layerKey, index) => {
              const selectedItem = getSelectedItemData(layerKey, selectedOptions[layerKey]);
              if (!selectedItem) return null;
              const zIndexMap = { 'sloj-odin': 1, 'sloj-dva': 10, 'sloj-tri': 2 };
              return (
                <img
                  key={layerKey}
                  src={`/layers/${selectedHeight}/${sizeKind(selectedSize)}/${layerKey}/${selectedItem.slug}.webp`}
                  alt={selectedItem.name}
                  className={`mattress-layer layer-${index + 1}`}
                  style={{ zIndex: zIndexMap[layerKey] }}
                />
              );
            })}
          </div>
        </div>

        {/* Селекторы размеров и высоты */}
        <div className="controls">
          <div className="control-group">
            <h3 className="control-title">Размер</h3>
            <div className="control-options size-options">
              {SIZES.map(sz => (
                <label key={sz} className="control-item">
                  <input
                    type="radio"
                    name="size"
                    value={sz}
                    checked={selectedSize === sz}
                    onChange={() => setSelectedSize(sz)}
                  />
                  <span className="control-box">{sz}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="control-group">
            <h3 className="control-title">Высота</h3>
            <div className="control-options height-options">
              {HEIGHTS.map(h => (
                <label key={h} className="control-item">
                  <input
                    type="radio"
                    name="height"
                    value={h}
                    checked={selectedHeight === h}
                    onChange={() => setSelectedHeight(h)}
                  />
                  <span className="control-box">{h} см</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Секции с кнопками — горизонтально на ПК */}
        <div className="selectors" ref={selectorsTopRef}>
          {visibleKeys.map((key) => (
            <OptionGroup
              key={key}
              title={LAYER_TITLES[key]}
              options={configData.mattressLayers}
              name={key}
              selectedId={selectedOptions[key]}
              onChange={handleOptionChange}
              columnsDesktop={3}
              columnsMobile={5}
            />
          ))}

          <OptionGroup
            title={LAYER_TITLES['potah']}
            options={configData.covers}
            name="potah"
            selectedId={selectedOptions['potah']}
            onChange={handleOptionChange}
            columnsDesktop={3}
            columnsMobile={5}
          />
        </div>

        {/* Калькулятор — sticky блок на десктопе */}
        <aside className="sidebar" ref={priceCalcRef}>
          <div className="price-calculator">
            <div className="price-header">
              <span className="price-label">Цена и подробности</span>
              <div className="price-amount">
                <span className="price-value">{totalPrice.toLocaleString('ru-RU')}</span>
                <span className="price-currency">Kč</span>
              </div>
            </div>

            <div className="price-breakdown">
              <div className="price-row">
                <span>Высота</span><span>{selectedHeight} см</span><span className="price-col" />
              </div>
              <div className="price-row">
                <span>Размер</span><span>{selectedSize}</span><span className="price-col" />
              </div>

              {visibleKeys.map((key) => {
                const item = getSelectedItemData(key, selectedOptions[key]);
                return (
                  <div key={key} className="price-row">
                    <span>{LAYER_TITLES[key]}</span>
                    <span>{item?.name || '-'}</span>
                    <span className="price-col">
                      {item?.price ? `${item.price.toLocaleString('ru-RU')} Kč` : ''}
                    </span>
                  </div>
                );
              })}

              <div className="price-row">
                <span>Чехол</span>
                <span>{getSelectedItemData('potah', selectedOptions['potah'])?.name || '-'}</span>
                <span className="price-col">
                  {getSelectedItemData('potah', selectedOptions['potah'])?.price
                    ? `${getSelectedItemData('potah', selectedOptions['potah']).price.toLocaleString('ru-RU')} Kč`
                    : ''}
                </span>
              </div>
            </div>

            <button className="add-to-cart-btn" onClick={handleAddToCart}>
              Добавить в корзину
            </button>
          </div>
        </aside>
      </div>

      {/* Постоянный нижний блок с ценой */}
      <div className="bottom-bar" role="region" aria-label="Итоговая цена">
        <div className="bb-price">
          <span className="bb-value">{totalPrice.toLocaleString('ru-RU')}</span>
          <span className="bb-currency">Kč</span>
        </div>

        <div className="bb-actions">
          <button className="bb-btn" onClick={scrollToDetails}>Перейти к подробностям</button>
          {isMobile && (
            <button
              className="bb-btn secondary"
              onClick={() => setShowPinnedMattress(v => !v)}
            >
              {showPinnedMattress ? 'Выключить постоянное отображение матраса' : 'Включить постоянное отображение матраса'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
