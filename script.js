function vkInit() {
  return new Promise((resolve, reject) => {
    VK.init({
      apiId: 7256284
    });

    VK.Auth.login(data => {
      if (data.session) {
        resolve();
      } else {
        reject(new Error("Не удалось авторизоваться"));
      }
    }, 2);
  });
}

function vkApi(method, options) {
  if (!options.v) {
    options.v = "5.68";
  }

  return new Promise((resolve, reject) => {
    VK.api(method, options, data => {
      if (data.error) {
        reject(new Error(data.error.error_msg));
      } else {
        resolve(data.response);
      }
    });
  });
}

const cache = new Map();

function geocode(address) {
  if (cache.has(address)) {
    return cache.get(address);
  }

  cache.set(
    address,
    ymaps.geocode(address).then(result => {
      const points = result.geoObjects.toArray();

      if (points.length) {
        return points[0].geometry.getCoordinates();
      }
    })
  );

  return cache.get(address);
}

/*function geocode(address) {
      return ymaps.geocode(address)
          .then(result => {
              const points = result.geoObjects.toArray();

              if (points.length) {
                  return points[0].geometry.getCoordinates();
              }
          });
  }*/

let myMap;
let clusterer;

ymaps.ready(async () => {
  await vkInit();

  const [me] = await vkApi("users.get", { fields: "city,country" });
  const friends = await vkApi("friends.get", {
    fields: "city,country,photo_100"
  });
  // template
  const balloonTemplate = document.querySelector("#ballonTemplate").innerHTML;
  const renderBalloon = Handlebars.compile(balloonTemplate);

  friends.items.push(me);

  myMap = new ymaps.Map(
    "map",
    {
      center: [51.13, 71.43], // Москва
      zoom: 4
    },
    { searchControlProvider: "yandex#search" }
  );

  clusterer = new ymaps.Clusterer({
    preset: "islands#invertedVioletClusterIcons",
    clusterDisableClickZoom: true,
    // openBalloonOnClick: false,
    // Устанавливаем стандартный макет балуна кластера "Карусель".
    clusterBalloonContentLayout: "cluster#balloonCarousel",
    // В данном примере балун никогда не будет открываться в режиме панели.
    clusterBalloonPanelMaxMapArea: 0,
    // Устанавливаем размеры макета контента балуна (в пикселях).
    clusterBalloonContentLayoutWidth: 200,
    clusterBalloonContentLayoutHeight: 160,
    // Устанавливаем максимальное количество элементов в нижней панели на одной странице
    clusterBalloonPagerSize: 5
  });

  myMap.geoObjects.add(clusterer);

  // friends -> country,city -> coord -> placemarks
  friends.items
    .filter(friend => friend.country && friend.country.title) // получить друзей, у которых есть страна
    .map(friend => {
      let parts = friend.country.title; // Россия

      if (friend.city) {
        parts += " " + friend.city.title; // Россия Москва
      }

      return [parts, friend];
    }) // [ 'Россия Москва', 'Норвегия', .... ]
    .map(async ([address, friend]) => {
      // 'Россия Москва'
      const coord = await geocode(address); // [54.45635636464, 67.4563564354]

      const flatFriend = flatFriendField(friend);

      const placemark = new ymaps.Placemark(
        coord,
        {
          balloonContentBody: renderBalloon(flatFriend)
        },
        { preset: "islands#blueHomeCircleIcon" }
      );
      clusterer.add(placemark);
    });
});

function flatFriendField(friend) {
  return friend.city
    ? {
        ...friend,
        country: friend.country.title,
        city: friend.city.title
      }
    : {
        ...friend,
        country: friend.country.title
      };
}
