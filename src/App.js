// /src/App.js
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
  useCallback,
} from 'react';
import './App.css';
import ShoppingCart from './components/ShoppingCart';

/** ---------- Константы и утилиты ---------- */

const SIZES = [
  '80x190',
  '85x195',
  '80x200',
  '90x200',
  '100x200',
  '120x200',
  '140x200',
  '160x200',
  '180x200',
  '200x200',
];
const HEIGHTS = [10, 20, 30]; // см

const sizeKind = (s) => (+s.split('x')[0] >= 160 ? 'double' : 'single');
const visibleLayerKeys = {
  10: ['sloj-odin'],
  20: ['sloj-odin', 'sloj-dva'],
  30: ['sloj-odin', 'sloj-dva', 'sloj-tri'],
};

// Функция для проверки доступности слоя в определенной высоте
const isLayerAvailableAtHeight = (layer, height) => {
  if (!layer || !layer.availableHeights) return true; // совместимость со старой структурой
  return layer.availableHeights.includes(height);
};

// Функция для получения цены слоя для определенного размера
const getLayerPrice = (layer, size) => {
  if (!layer) return 0;
  // Новая структура с ценами по размерам
  if (layer.prices && typeof layer.prices === 'object') {
    return layer.prices[size] || 0;
  }
  // Старая структура с единой ценой (для обратной совместимости)
  return layer.price || 0;
};

const LAYER_TITLES = {
  'sloj-odin': 'Слой 1',
  'sloj-dva': 'Слой 2',
  'sloj-tri': 'Слой 3',
  potah: 'Чехол',
};

/** Ранний mobile-режим — с 1024px */
const useIsMobile = (bp = 1024) => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= bp : false,
  );
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
      {i < parts.length - 1 ? <br /> : null}
    </React.Fragment>
  ));
};

/** Форматирование описаний с поддержкой HTML тегов */
const formatDescription = (html) => {
  if (!html) return null;
  
  // Заменяем переносы строк на <br> если нужно
  const formattedHtml = String(html)
    .replace(/\n/g, '<br>')
    .replace(/\|/g, '<br>');
  
  return <div dangerouslySetInnerHTML={{ __html: formattedHtml }} />;
};

/** Определение оптимального количества колонок для опций */
const getOptimalColumns = (containerWidth, isMobile, baseColumns) => {
  if (isMobile) {
    // На планшетах/мобильных устройствах адаптируем под ширину экрана
    if (containerWidth < 360) return 3;
    if (containerWidth < 520) return 4;
    if (containerWidth < 768) return 5; // Планшеты - больше колонок для компактности
    if (containerWidth < 1024) return 6; // Большие планшеты
    return 5; // По умолчанию для мобильных
  }
  // Десктоп
  if (containerWidth < 240) return 2;
  if (containerWidth < 300) return 3;
  return baseColumns;
};

/** Группа опций */
const OptionGroup = ({
  title,
  options,
  name,
  selectedId,
  onChange,
  columnsDesktop = 3,
  columnsMobile = 5,
  onLayoutChange,
}) => {
  const isMobile = useIsMobile();
  const containerRef = useRef(null);
  const [actualColumns, setActualColumns] = useState(
    isMobile ? columnsMobile : columnsDesktop,
  );

  useEffect(() => {
    const updateColumns = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const cols = getOptimalColumns(width, isMobile, columnsDesktop);
        setActualColumns((prev) => {
          if (prev !== cols) {
            if (typeof onLayoutChange === 'function') {
              requestAnimationFrame(() => onLayoutChange());
            }
          }
          return cols;
        });
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
  }, [isMobile, columnsDesktop, onLayoutChange]);

  return (
    <section className="layer-selector glass-panel" ref={containerRef}>
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
                <div className="option-media">
                  {img ? (
                    <img
                      src={img}
                      alt={opt.name}
                      className="option-image"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="image-placeholder" aria-hidden="true" />
                  )}
                </div>
                <span className="option-name">{formatLabel(opt.name)}</span>
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
};

/** ---------- URL функции ---------- */

const generateUrlPath = (
  size,
  height,
  options,
  visibleKeys,
  urlMapping,
) => {
  if (!urlMapping) return '';

  const parts = [size, `${height}cm`];

  for (const key of visibleKeys) {
    const id = options[key];
    const urlKey = urlMapping.layers[id] || id;
    parts.push(urlKey);
  }

  const coverId = options['potah'];
  const coverUrlKey = urlMapping.covers[coverId] || coverId;
  parts.push(coverUrlKey);

  return parts.join('-');
};

const parseUrlPath = (pathname, urlMapping) => {
  if (!urlMapping) return null;

  const pathParts = pathname.split('/');
  const config = pathParts[pathParts.length - 1];
  if (!config || config === '') return null;

  const parts = config.split('-');
  if (parts.length < 3) return null;

  const size = parts[0];
  if (!SIZES.includes(size)) return null;

  const heightStr = parts[1];
  const height = parseInt(heightStr.replace('cm', ''));
  if (!HEIGHTS.includes(height)) return null;

  const reverseMapping = { layers: {}, covers: {} };
  Object.entries(urlMapping.layers).forEach(([key, value]) => {
    reverseMapping.layers[value] = key;
  });
  Object.entries(urlMapping.covers).forEach(([key, value]) => {
    reverseMapping.covers[value] = key;
  });

  const vKeys = visibleLayerKeys[height];
  const expectedParts = 2 + vKeys.length + 1;
  if (parts.length !== expectedParts) return null;

  const options = {};
  let partIndex = 2;
  for (const key of vKeys) {
    const urlKey = parts[partIndex];
    const id = reverseMapping.layers[urlKey] || urlKey;
    options[key] = id;
    partIndex++;
  }

  const coverUrlKey = parts[partIndex];
  const coverId = reverseMapping.covers[coverUrlKey] || coverUrlKey;
  options['potah'] = coverId;

  return { size, height, options };
};

/** ---------- Основной компонент ---------- */

const App = () => {
  const [configData, setConfigData] = useState(null);
  const [layerDescriptions, setLayerDescriptions] = useState(null);
  const [urlMapping, setUrlMapping] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({
    'sloj-odin': null,
    'sloj-dva': null,
    'sloj-tri': null,
    potah: null,
  });
  const [selectedSize, setSelectedSize] = useState(SIZES[0]);
  const [selectedHeight, setSelectedHeight] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [urlInitialized, setUrlInitialized] = useState(false);
  
  // Shopping cart state
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const isMobile = useIsMobile(1100);
  const priceCalcRef = useRef(null);
  const selectorsTopRef = useRef(null);
  const appRootRef = useRef(null);
  const recalcRafId = useRef(null);

  // Глобальная, единая высота карточек
  const [globalCardHeight, setGlobalCardHeight] = useState(56);


  // Загрузка конфигурации + url-mapping
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const [configRes, mappingRes, descRes] = await Promise.all([
          fetch('/data/layers-config.json'),
          fetch('/data/url-mapping.json'),
          fetch('/data/layer-descriptions.json'),
        ]);
        if (!configRes.ok || !mappingRes.ok || !descRes.ok)
          throw new Error('Failed to load configuration');

        const [data, mapping, descriptions] = await Promise.all([
          configRes.json(),
          mappingRes.json(),
          descRes.json(),
        ]);
        if (cancelled) return;

        setConfigData(data);
        setUrlMapping(mapping);
        setLayerDescriptions(descriptions);

        const urlConfig = parseUrlPath(window.location.pathname, mapping);
        const setDefaults = () => {
          setSelectedOptions({
            'sloj-odin': data.mattressLayers[0]?.id || null,
            'sloj-dva': data.mattressLayers[0]?.id || null,
            'sloj-tri': data.mattressLayers[0]?.id || null,
            potah: data.covers[0]?.id || null,
          });
        };

        if (urlConfig && data) {
          const isValidConfig =
            data.mattressLayers.some(
              (l) => l.id === urlConfig.options['sloj-odin'],
            ) &&
            (!urlConfig.options['sloj-dva'] ||
              data.mattressLayers.some(
                (l) => l.id === urlConfig.options['sloj-dva'],
              )) &&
            (!urlConfig.options['sloj-tri'] ||
              data.mattressLayers.some(
                (l) => l.id === urlConfig.options['sloj-tri'],
              )) &&
            data.covers.some((c) => c.id === urlConfig.options['potah']);

          if (isValidConfig) {
            setSelectedSize(urlConfig.size);
            setSelectedHeight(urlConfig.height);
            setSelectedOptions({
              'sloj-odin':
                urlConfig.options['sloj-odin'] ||
                data.mattressLayers[0]?.id ||
                null,
              'sloj-dva':
                urlConfig.options['sloj-dva'] ||
                data.mattressLayers[0]?.id ||
                null,
              'sloj-tri':
                urlConfig.options['sloj-tri'] ||
                data.mattressLayers[0]?.id ||
                null,
              potah:
                urlConfig.options['potah'] || data.covers[0]?.id || null,
            });
          } else {
            setDefaults();
          }
        } else {
          setDefaults();
        }

        setUrlInitialized(true);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError('Ошибка загрузки конфигурации');
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Обновление URL при изменении параметров
  useEffect(() => {
    if (!urlInitialized || !configData || !urlMapping) return;

    const vKeys = visibleLayerKeys[selectedHeight];
    const urlPath = generateUrlPath(
      selectedSize,
      selectedHeight,
      selectedOptions,
      vKeys,
      urlMapping,
    );

    const pathParts = window.location.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    const isConfig = lastPart && lastPart.includes('x') && lastPart.includes('cm');

    const basePath = isConfig
      ? pathParts.slice(0, -1).join('/') || '/'
      : window.location.pathname;

    const newUrl = basePath.endsWith('/')
      ? basePath + urlPath
      : basePath + '/' + urlPath;

    window.history.replaceState({}, '', newUrl);
  }, [
    selectedSize,
    selectedHeight,
    selectedOptions,
    urlInitialized,
    configData,
    urlMapping,
  ]);

  // Проверка совместимости выбранных слоев при изменении высоты матраса
  useEffect(() => {
    if (!configData || !urlInitialized) return;

    const vKeys = visibleLayerKeys[selectedHeight];
    let needsUpdate = false;
    const updatedOptions = { ...selectedOptions };

    // Проверяем каждый видимый слой
    vKeys.forEach(layerKey => {
      const selectedLayerId = selectedOptions[layerKey];
      if (selectedLayerId) {
        const selectedLayer = configData.mattressLayers.find(l => l.id === selectedLayerId);
        
        // Если выбранный слой недоступен для новой высоты, сбрасываем на первый доступный
        if (selectedLayer && !isLayerAvailableAtHeight(selectedLayer, selectedHeight)) {
          const availableLayer = configData.mattressLayers.find(layer => 
            isLayerAvailableAtHeight(layer, selectedHeight)
          );
          
          if (availableLayer) {
            updatedOptions[layerKey] = availableLayer.id;
            needsUpdate = true;
          }
        }
      }
    });

    if (needsUpdate) {
      setSelectedOptions(updatedOptions);
    }
  }, [selectedHeight, configData, urlInitialized, selectedOptions]);

  // Данные выбранного элемента с учетом размера и высоты
  const getSelectedItemData = useCallback(
    (layerKey, itemId) => {
      if (!configData) return null;
      if (layerKey === 'potah')
        return configData.covers.find((c) => c.id === itemId) || null;
      const layer = configData.mattressLayers.find((l) => l.id === itemId) || null;
      if (!layer) return null;
      
      // Возвращаем слой с актуальной ценой для текущего размера
      return {
        ...layer,
        price: getLayerPrice(layer, selectedSize)
      };
    },
    [configData, selectedSize],
  );

  /** Стабильный пересчёт общей min-height карточек */
  const recalcGlobalCardHeight = () => {
    const nameEls = Array.from(
      document.querySelectorAll('.option-card .option-name'),
    );
    if (!nameEls.length) return;

    const screenWidth = window.innerWidth;
    let imageH, gap, paddingTopBottom, border;

    if (screenWidth <= 480) {
      imageH = 28;
      gap = 6;
      paddingTopBottom = 12;
      border = 4;
    } else if (screenWidth <= 1024) {
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
    nameEls.forEach((el) => {
      maxText = Math.max(maxText, el.scrollHeight);
    });

    const next = Math.max(48, Math.ceil(base + maxText));
    setGlobalCardHeight(next);
  };

  // Планировщик пересчёта на следующий кадр — устойчив к zoom/перестройке сетки
  const scheduleRecalc = useCallback(() => {
    if (recalcRafId.current) cancelAnimationFrame(recalcRafId.current);
    recalcRafId.current = requestAnimationFrame(() => {
      recalcRafId.current = null;
      recalcGlobalCardHeight();
    });
  }, []);

  useLayoutEffect(() => {
    scheduleRecalc();
  }, [configData, selectedOptions, selectedHeight, isMobile, scheduleRecalc]);

  // Ресайз/загрузка/догрузка картинок + изменения контейнера
  useEffect(() => {
    const onResizeOrLoad = () => scheduleRecalc();
    window.addEventListener('resize', onResizeOrLoad);
    window.addEventListener('load', onResizeOrLoad);

    const imgs = Array.from(document.querySelectorAll('.option-image'));
    imgs.forEach((img) => img.addEventListener('load', onResizeOrLoad));

    const ro = new ResizeObserver(() => scheduleRecalc());
    if (appRootRef.current) ro.observe(appRootRef.current);

    const timer = setTimeout(() => scheduleRecalc(), 500);

    // Реакция на изменение масштаба/вьюпорта (браузерный zoom)
    const vv = window.visualViewport;
    if (vv && typeof vv.addEventListener === 'function') {
      vv.addEventListener('resize', onResizeOrLoad);
    }

    return () => {
      window.removeEventListener('resize', onResizeOrLoad);
      window.removeEventListener('load', onResizeOrLoad);
      imgs.forEach((img) => img.removeEventListener('load', onResizeOrLoad));
      if (vv && typeof vv.removeEventListener === 'function') {
        vv.removeEventListener('resize', onResizeOrLoad);
      }
      ro.disconnect();
      clearTimeout(timer);
    };
  }, [scheduleRecalc]);

  // Итоговая цена с учетом размеров и доступности слоев по высоте
  const totalPrice = useMemo(() => {
    if (!configData) return 0;
    let total = 0;
    for (const key of visibleLayerKeys[selectedHeight]) {
      const id = selectedOptions[key];
      const item = getSelectedItemData(key, id);
      if (item && item.price) {
        total += item.price;
      }
    }
    const cover = getSelectedItemData('potah', selectedOptions['potah']);
    if (cover) total += cover.price || 0;
    return total;
  }, [getSelectedItemData, configData, selectedOptions, selectedHeight]);

  // Построение описательных блоков (динамические, статические, дополнительные)
  const descriptionData = useMemo(() => {
    if (!configData) return { dynamicBlocks: [], infoBlocks: [] };

    const vKeys = visibleLayerKeys[selectedHeight] || [];

    // 1) Группируем одинаковые наполнения (необязательно соседние)
    //    Пример: если слои 1 и 3 одинаковые, а 2 — другой, то получаем группу с индексами [1,3]
    const groups = [];
    const slugToGroupIndex = new Map();
    vKeys.forEach((k, idx) => {
      const id = selectedOptions[k];
      const item = getSelectedItemData(k, id);
      if (!item) return;
      const indexHuman = idx + 1; // 1..N
      const groupKey = item?.slug || item?.name || `unknown-${indexHuman}`;

      if (slugToGroupIndex.has(groupKey)) {
        const gi = slugToGroupIndex.get(groupKey);
        groups[gi].indices.push(indexHuman);
      } else {
        const gi = groups.length;
        slugToGroupIndex.set(groupKey, gi);
        groups.push({
          name: item.name,
          slug: item.slug,
          item,
          indices: [indexHuman],
        });
      }
    });

    // 2) Динамические блоки по группам
    const layerDescMap = layerDescriptions || {};
    const staticFromDesc = Array.isArray(layerDescMap.staticBlocks)
      ? layerDescMap.staticBlocks
      : [];

    const humanizeIndices = (arr) => {
      if (!arr.length) return '';
      if (arr.length === 1) return `Слой ${arr[0]}`;
      if (arr.length === 2) return `Слой ${arr[0]} и ${arr[1]}`;
      return `Слой ${arr.slice(0, -1).join(', ')} и ${arr[arr.length - 1]}`;
    };

    const dynamicBlocks = groups.map((g) => {
      const desc = layerDescMap[g.slug] || layerDescMap[g.name] || null;
      const titleName = (desc?.name || g.name || '').toString();
      return {
        kind: 'dynamic',
        key: `dyn-${g.slug}-${g.indices.join('-')}`,
        title: `${humanizeIndices(g.indices)}: ${titleName}`.trim(),
        name: titleName,
        description: desc?.description || '',
        image: desc?.image || g.item?.icon || '',
      };
    });

    // 3) Статические блоки (всегда есть, сортируем по order)
    const staticBlocks = staticFromDesc
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((b) => ({
        kind: 'static',
        key: `static-${b.id}`,
        title: b.title,
        name: b.title,
        description: b.description || '',
        image: b.image || '',
        order: typeof b.order === 'number' ? b.order : 1000,
      }));

    // 4) Дополнительные блоки от использованных наполнений (уникальные)
    const usedSlugs = Array.from(new Set(groups.map((g) => g.slug).filter(Boolean)));
    const additional = [];
    const seenIds = new Set();
    usedSlugs.forEach((slug) => {
      const desc = layerDescMap[slug];
      if (!desc || !Array.isArray(desc.additionalBlocks)) return;
      desc.additionalBlocks.forEach((ab) => {
        if (ab && !seenIds.has(ab.id)) {
          seenIds.add(ab.id);
          additional.push({
            kind: 'additional',
            key: `add-${ab.id}`,
            title: ab.title || '',
            name: ab.title || '',
            description: ab.description || '',
            image: ab.image || '',
            order: typeof ab.order === 'number' ? ab.order : 1000,
          });
        }
      });
    });

    const infoBlocks = [...staticBlocks, ...additional].sort(
      (a, b) => (a.order || 0) - (b.order || 0),
    );

    return { dynamicBlocks, infoBlocks };
  }, [configData, selectedOptions, selectedHeight, getSelectedItemData, layerDescriptions]);

  const handleOptionChange = (layerKey, itemId) => {
    setSelectedOptions((prev) => ({ ...prev, [layerKey]: itemId }));
  };

  // Shopping cart functions
  const handleAddToCart = () => {
    if (!configData) return;

    const getName = (key) =>
      getSelectedItemData(key, selectedOptions[key])?.name || '';
    
    // Формируем название только для видимых слоев
    const vKeys = visibleLayerKeys[selectedHeight];
    const layerNames = vKeys.map(key => getName(key)).filter(Boolean);
    const layersText = layerNames.join(' + ');
    
    const name = `Матрас ${selectedSize}, ${selectedHeight}см — ${layersText} | Чехол: ${getName('potah')}`;

    // Формируем конфигурацию только для видимых слоев
    const configuration = {
      cover: getName('potah'),
      size: selectedSize,
      height: `${selectedHeight} см`,
    };
    
    vKeys.forEach((key, index) => {
      configuration[`layer${index + 1}`] = getName(key);
    });

    const cartItem = {
      id: `mattress-${Date.now()}`, // Simple ID generation
      name,
      price: totalPrice,
      quantity: 1,
      configuration,
    };

    // Check if this exact configuration already exists
    const existingItemIndex = cartItems.findIndex(item => 
      item.name === cartItem.name && 
      JSON.stringify(item.configuration) === JSON.stringify(cartItem.configuration)
    );

    if (existingItemIndex >= 0) {
      // Update quantity of existing item
      setCartItems(prevItems => 
        prevItems.map((item, index) => 
          index === existingItemIndex 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      // Add new item
      setCartItems(prevItems => [...prevItems, cartItem]);
    }

    // Open cart modal
    setIsCartOpen(true);
  };

  const handleUpdateQuantity = (itemIndex, newQuantity) => {
    if (newQuantity < 1) return;
    
    setCartItems(prevItems => 
      prevItems.map((item, index) => 
        index === itemIndex 
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const handleRemoveItem = (itemIndex) => {
    setCartItems(prevItems => 
      prevItems.filter((_, index) => index !== itemIndex)
    );
  };

  const cartTotal = useMemo(() => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [cartItems]);

  const scrollToDetails = () => {
    const target = priceCalcRef.current || selectorsTopRef.current;
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="app-root loading-screen">
        Загрузка конфигуратора...
      </div>
    );
  }
  if (error || !configData) {
    return (
      <div className="app-root error-screen">{error || 'Ошибка загрузки'}</div>
    );
  }

  const visibleKeys = visibleLayerKeys[selectedHeight];
  

  return (
    <div
      ref={appRootRef}
      className="app-root"
      style={{ '--global-card-min-height': `${globalCardHeight}px` }}
    >
      {/* Cart Button */}
      <button 
        className="cart-button"
        onClick={() => setIsCartOpen(true)}
        aria-label="Открыть корзину"
      >
        🛒 {cartItems.length > 0 && <span className="cart-badge">{cartItems.length}</span>}
      </button>

      {/* Контент */}
      <div className="layout">
        {/* Визуализация для десктопа (обычная) */}
        <div className="visual glass-panel">
          
          <div className="layers-canvas">
            <img
              src={`/layers/${selectedHeight}/${sizeKind(
                selectedSize,
              )}/frame.webp`}
              alt="Каркас матраса"
              className="mattress-layer layer-frame"
              style={{ zIndex: 100 }}
            />
            {visibleKeys.map((layerKey, index) => {
              const selectedItem = getSelectedItemData(
                layerKey,
                selectedOptions[layerKey],
              );
              if (!selectedItem) return null;
              const zIndexMap = { 'sloj-odin': 1, 'sloj-dva': 10, 'sloj-tri': 2 };
              return (
                <img
                  key={layerKey}
                  src={`/layers/${selectedHeight}/${sizeKind(
                    selectedSize,
                  )}/${layerKey}/${selectedItem.slug}.webp`}
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
          <div className="control-group glass-panel">
            <h3 className="control-title">Размер</h3>
            <div className="control-options size-options">
              {SIZES.map((sz) => (
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

          <div className="control-group glass-panel">
            <h3 className="control-title">Высота</h3>
            <div className="control-options height-options">
              {HEIGHTS.map((h) => (
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

        {/* Секции с кнопками */}
        <div className="selectors" ref={selectorsTopRef}>
          {visibleKeys.map((key) => {
            // Фильтруем слои по доступности для текущей высоты
            const availableOptions = configData.mattressLayers.filter(layer => 
              isLayerAvailableAtHeight(layer, selectedHeight)
            );
            
            return (
              <OptionGroup
                key={key}
                title={LAYER_TITLES[key]}
                options={availableOptions}
                name={key}
                selectedId={selectedOptions[key]}
                onChange={handleOptionChange}
                columnsDesktop={3}
                columnsMobile={5}
                onLayoutChange={scheduleRecalc}
              />
            );
          })}

          <OptionGroup
            title={LAYER_TITLES['potah']}
            options={configData.covers}
            name="potah"
            selectedId={selectedOptions['potah']}
            onChange={handleOptionChange}
            columnsDesktop={3}
            columnsMobile={5}
            onLayoutChange={scheduleRecalc}
          />
        </div>

        {/* Калькулятор — sticky на десктопе */}
        <aside className="sidebar" ref={priceCalcRef}>
          <div className="price-calculator glass-panel">
            <div className="price-header">
              <span className="price-label">Цена и подробности</span>
              <div className="price-amount">
                <span className="price-value">
                  {totalPrice.toLocaleString('ru-RU')}
                </span>
                <span className="price-currency">Kč</span>
              </div>
            </div>

            <div className="price-breakdown">
              <div className="price-row">
                <span>Высота</span>
                <span>{selectedHeight} см</span>
                <span className="price-col" />
              </div>
              <div className="price-row">
                <span>Размер</span>
                <span>{selectedSize}</span>
                <span className="price-col" />
              </div>

              {visibleKeys.map((key) => {
                const item = getSelectedItemData(
                  key,
                  selectedOptions[key],
                );
                return (
                  <div key={key} className="price-row">
                    <span>{LAYER_TITLES[key]}</span>
                    <span>{item?.name || '-'}</span>
                    <span className="price-col">
                      {item?.price
                        ? `${item.price.toLocaleString('ru-RU')} Kč`
                        : ''}
                    </span>
                  </div>
                );
              })}

              <div className="price-row">
                <span>Чехол</span>
                <span>
                  {getSelectedItemData('potah', selectedOptions['potah'])
                    ?.name || '-'}
                </span>
                <span className="price-col">
                  {getSelectedItemData('potah', selectedOptions['potah'])
                    ?.price
                    ? `${getSelectedItemData(
                        'potah',
                        selectedOptions['potah'],
                      ).price.toLocaleString('ru-RU')} Kč`
                    : ''}
                </span>
              </div>
            </div>

            <button className="add-to-cart-btn" onClick={handleAddToCart}>
              Добавить в корзину
            </button>
          </div>
        </aside>

        {/* Блоки описания слоёв и информации */}
        <section className="details glass-panel">
        {descriptionData.dynamicBlocks.map((b) => (
          <article key={b.key} className="detail-block">
            <div className="detail-card">
              {b.image ? (
                <div className="detail-image-wrap">
                  <img src={b.image} alt={b.name} className="detail-image" onError={(e)=>{e.currentTarget.style.display='none';}} />
                </div>
              ) : null}
              <div className="detail-content">
                <h4 className="detail-title">{b.title}</h4>
                {b.description ? (
                  <div className="detail-text">{formatDescription(b.description)}</div>
                ) : null}
              </div>
            </div>
            <div className="detail-divider" />
          </article>
        ))}

        {/* Чехол — после наполнителя */}
        {(() => {
          const coverId = selectedOptions['potah'];
          const coverMap = (layerDescriptions && layerDescriptions.coverDescriptions) || {};
          const coverDesc = coverMap[coverId];
          if (!coverDesc) return null;
          const b = {
            key: `cover-${coverId}`,
            title: coverDesc.title,
            name: coverDesc.title,
            description: coverDesc.description,
            image: coverDesc.image,
          };
          return (
            <article key={b.key} className="detail-block">
              <div className="detail-card">
                {b.image ? (
                  <div className="detail-image-wrap">
                    <img src={b.image} alt={b.name} className="detail-image" onError={(e)=>{e.currentTarget.style.display='none';}} />
                  </div>
                ) : null}
                <div className="detail-content">
                  <h4 className="detail-title">{b.title}</h4>
                  {b.description ? (
                    <p className="detail-text">{b.description}</p>
                  ) : null}
                </div>
              </div>
              <div className="detail-divider" />
            </article>
          );
        })()}

        {descriptionData.infoBlocks.map((b) => (
          <article key={b.key} className="detail-block">
            <div className="detail-card">
              {b.image ? (
                <div className="detail-image-wrap">
                  <img src={b.image} alt={b.name} className="detail-image" onError={(e)=>{e.currentTarget.style.display='none';}} />
                </div>
              ) : null}
              <div className="detail-content">
                <h4 className="detail-title">{b.title}</h4>
                {b.description ? (
                  <div className="detail-text">{formatDescription(b.description)}</div>
                ) : null}
              </div>
            </div>
            <div className="detail-divider" />
          </article>
        ))}
        </section>
      </div>

      {/* Постоянный нижний блок с ценой */}
      <div className="bottom-bar" role="region" aria-label="Итоговая цена">
        <div className="bb-price">
          <span className="bb-value">
            {totalPrice.toLocaleString('ru-RU')}
          </span>
          <span className="bb-currency">Kč</span>
        </div>

        <div className="bb-actions">
          <button className="bb-btn" onClick={scrollToDetails}>
            Перейти к подробностям
          </button>
        </div>
      </div>

      {/* Shopping Cart Modal */}
      <ShoppingCart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        totalPrice={cartTotal}
      />
    </div>
  );
};

export default App;
