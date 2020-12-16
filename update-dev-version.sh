#!/bin/bash
# Arguments: OLD VERSION | NEW VERSION
mv /mnt/c/spaceabyss/public/dev_client/client_click_${1}.js /mnt/c/spaceabyss/public/dev_client/client_click_${2}.js
mv /mnt/c/spaceabyss/public/dev_client/client_functions_${1}.js /mnt/c/spaceabyss/public/dev_client/client_function_${2}.js
mv /mnt/c/spaceabyss/public/dev_client/client_network_${1}.js /mnt/c/spaceabyss/public/dev_client/client_network_${2}.js
mv /mnt/c/spaceabyss/public/dev_client/effects_${1}.js /mnt/c/spaceabyss/public/dev_client/effects_${2}.js
mv /mnt/c/spaceabyss/public/dev_client/monster_${1}.js /mnt/c/spaceabyss/public/dev_client/monster_${2}.js
mv /mnt/c/spaceabyss/public/dev_client/planet_${1}.js /mnt/c/spaceabyss/public/dev_client/planet_${2}.js
mv /mnt/c/spaceabyss/public/dev_client/player_${1}.js /mnt/c/spaceabyss/public/dev_client/player_${2}.js

# Update our index.html file to call the updated files
sed -i "s/client_functions_${1}/client_functions_${2}/g" /mnt/c/spaceabyss/public/dev_client/index.html
sed -i "s/client_network_${1}/client_network_${2}/g" /mnt/c/spaceabyss/public/dev_client/index.html
sed -i "s/client_click_${1}/client_click_${2}/g" /mnt/c/spaceabyss/public/dev_client/index.html
sed -i "s/effects_${1}/effects_${2}/g" /mnt/c/spaceabyss/public/dev_client/index.html
sed -i "s/monster_${1}/monster_${2}/g" /mnt/c/spaceabyss/public/dev_client/index.html
sed -i "s/planet_${1}/planet_${2}/g" /mnt/c/spaceabyss/public/dev_client/index.html
sed -i "s/player_${1}/player_${2}/g" /mnt/c/spaceabyss/public/dev_client/index.html

# put back our dev port, and our non minified version of phaser
sed -i 's/8000/8010/g' /mnt/c/spaceabyss/public/dev_client/index.html
sed -i 's/phaser-3.15.1.min.js/phaser-3.15.1.js/g' /mnt/c/spaceabyss/public/dev_client/test.html

