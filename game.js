// 游戏状态
const GameState = {
    SELECTING: 'selecting',
    REVEALING: 'revealing',
    FINISHED: 'finished'
};

class AreaGame {
    constructor() {
        this.currentLevel = 1;
        this.maxLevel = 30;
        this.state = GameState.SELECTING;
        this.selectedRegion = null;
        this.regions = [];
        this.gridSize = 60; // 每个格子的大小
        this.gridWidth = 11; // 网格宽度：11格
        this.gridHeight = 7; // 网格高度：7格 (总共77格，每个区域约19格)
        
        this.initElements();
        this.initLevel();
        this.attachEventListeners();
    }

    initElements() {
        this.svg = document.getElementById('game-svg');
        this.regionsContainer = document.getElementById('regions-container');
        this.gridContainer = document.getElementById('grid-container');
        this.markersContainer = document.getElementById('markers-container');
        this.ranksContainer = document.getElementById('ranks-container');
        this.revealBtn = document.getElementById('reveal-btn');
        this.levelDisplay = document.getElementById('current-level');
    }

    // 30个关卡配置 - 每个关卡有不同的区域形状
    getLevelConfig(level) {
        const configs = [
            // 关卡1-5: 简单的分割模式
            { regions: this.generateRectangleDivision(1) },
            { regions: this.generateRectangleDivision(2) },
            { regions: this.generateRectangleDivision(3) },
            { regions: this.generateRectangleDivision(4) },
            { regions: this.generateRectangleDivision(5) },
            
            // 关卡6-10: 更复杂的分割
            { regions: this.generateRectangleDivision(6) },
            { regions: this.generateRectangleDivision(7) },
            { regions: this.generateRectangleDivision(8) },
            { regions: this.generateRectangleDivision(9) },
            { regions: this.generateRectangleDivision(10) },
            
            // 关卡11-15: 不规则分割
            { regions: this.generateRectangleDivision(11) },
            { regions: this.generateRectangleDivision(12) },
            { regions: this.generateRectangleDivision(13) },
            { regions: this.generateRectangleDivision(14) },
            { regions: this.generateRectangleDivision(15) },
            
            // 关卡16-20: 混合挑战
            { regions: this.generateRectangleDivision(16) },
            { regions: this.generateRectangleDivision(17) },
            { regions: this.generateRectangleDivision(18) },
            { regions: this.generateRectangleDivision(19) },
            { regions: this.generateRectangleDivision(20) },
            
            // 关卡21-25: 高难度
            { regions: this.generateRectangleDivision(21) },
            { regions: this.generateRectangleDivision(22) },
            { regions: this.generateRectangleDivision(23) },
            { regions: this.generateRectangleDivision(24) },
            { regions: this.generateRectangleDivision(25) },
            
            // 关卡26-30: 终极挑战
            { regions: this.generateRectangleDivision(26) },
            { regions: this.generateRectangleDivision(27) },
            { regions: this.generateRectangleDivision(28) },
            { regions: this.generateRectangleDivision(29) },
            { regions: this.generateRectangleDivision(30) }
        ];
        
        return configs[level - 1] || configs[0];
    }

    // 生成矩形分割的4个区域 - 使用"初始化+扰动+面积平衡"三步方案
    generateRectangleDivision(seed) {
        const random = this.seededRandom(seed);
        const colors = ['#95a5a6', '#e74c3c', '#3498db', '#f39c12'];
        
        // 第一步：初始化四象限，提供稳定起点
        const grid = this.initializeQuadrants(random);
        let regionCells = this.extractRegionCells(grid);
        
        // 第二步：受控随机扰动，提升不规则性，同时保持连通
        this.randomMorphBoundaries(grid, regionCells, random);
        regionCells = this.extractRegionCells(grid);
        
        // 第三步：面积平衡，精确控制差异
        this.balanceAreas(grid, regionCells, random);
        regionCells = this.extractRegionCells(grid);
        
        const regions = regionCells.map((cells, i) => ({
            id: i,
            color: colors[i],
            path: this.gridToPath(cells),
            area: cells.length,
            cells
        }));
        
        for (let i = 0; i < 4; i++) {
            if (!this.verifyCellsConnected(regionCells[i])) {
                console.error(`错误：区域 ${i + 1} 不连通！`);
            }
        }
        
        return regions;
    }
    
    // 第一步：初始化四象限（十字分割并引入轻微偏移）
    initializeQuadrants(random) {
        const grid = Array(this.gridHeight).fill(null).map(() => Array(this.gridWidth).fill(0));
        
        const baseMidX = Math.floor(this.gridWidth / 2);
        const baseMidY = Math.floor(this.gridHeight / 2);
        const offsetX = Math.floor(random() * 3) - 1; // -1, 0, 1
        const offsetY = Math.floor(random() * 3) - 1; // -1, 0, 1
        
        const midX = Math.min(Math.max(baseMidX + offsetX, 3), this.gridWidth - 3);
        const midY = Math.min(Math.max(baseMidY + offsetY, 2), this.gridHeight - 2);
        
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (y < midY) {
                    grid[y][x] = (x < midX) ? 1 : 2;
                } else {
                    grid[y][x] = (x < midX) ? 3 : 4;
                }
            }
        }
        
        return grid;
    }
    
    // 第二步：受控随机扰动，打破矩形边界
    randomMorphBoundaries(grid, regionCells, random, maxAttempts = 600, areaTolerance = 4) {
        const totalCells = this.gridWidth * this.gridHeight;
        const targetArea = totalCells / 4;
        const minArea = Math.max(5, Math.floor(targetArea - areaTolerance));
        const maxArea = Math.ceil(targetArea + areaTolerance);
        
        let attempts = 0;
        let successes = 0;
        
        while (attempts < maxAttempts) {
            attempts++;
            const fromIdx = Math.floor(random() * 4);
            const fromRegion = fromIdx + 1;
            const fromArea = regionCells[fromIdx].length;
            if (fromArea <= minArea) continue;
            
            const boundaryCells = this.getBoundaryCellsForRegion(grid, fromRegion);
            if (boundaryCells.length === 0) continue;
            
            const candidate = boundaryCells[Math.floor(random() * boundaryCells.length)];
            const possibleTargets = candidate.adjacentRegions
                .filter(regionId => regionId >= 1 && regionId <= 4 && regionId !== fromRegion)
                .filter(regionId => regionCells[regionId - 1].length < maxArea);
            
            if (possibleTargets.length === 0) continue;
            
            const toRegion = possibleTargets[Math.floor(random() * possibleTargets.length)];
            const toIdx = toRegion - 1;
            
            if (this.canFlipCell(grid, [candidate.x, candidate.y], fromRegion, toRegion)) {
                grid[candidate.y][candidate.x] = toRegion;
                this.removeCellFromRegion(regionCells[fromIdx], candidate.x, candidate.y);
                regionCells[toIdx].push([candidate.x, candidate.y]);
                successes++;
            }
        }
        
        console.log(`随机扰动完成：尝试${attempts}次，成功移动${successes}次`);
    }
    
    removeCellFromRegion(cells, x, y) {
        const index = cells.findIndex(([cx, cy]) => cx === x && cy === y);
        if (index !== -1) {
            cells.splice(index, 1);
        }
    }
    
    // 获取某区域的边界格子及其邻接区域
    getBoundaryCellsForRegion(grid, regionId) {
        const boundary = [];
        
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (grid[y][x] !== regionId) continue;
                const adjacent = new Set();
                const neighbors = [
                    [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
                ];
                
                for (const [nx, ny] of neighbors) {
                    if (nx >= 0 && nx < this.gridWidth && ny >= 0 && ny < this.gridHeight) {
                        const neighborRegion = grid[ny][nx];
                        if (neighborRegion !== regionId) {
                            adjacent.add(neighborRegion);
                        }
                    }
                }
                
                if (adjacent.size > 0) {
                    boundary.push({ x, y, adjacentRegions: Array.from(adjacent) });
                }
            }
        }
        
        return boundary;
    }
    
    // 从网格提取各区域的格子列表
    extractRegionCells(grid) {
        const regionCells = [[], [], [], []];
        
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const region = grid[y][x];
                if (region >= 1 && region <= 4) {
                    regionCells[region - 1].push([x, y]);
                }
            }
        }
        
        return regionCells;
    }
    
    // 第三步：面积平衡，确保差异≤2格
    balanceAreas(grid, regionCells, random) {
        const maxIterations = 600;
        let failureStreak = 0;
        
        for (let iter = 0; iter < maxIterations; iter++) {
            const areas = regionCells.map(cells => cells.length);
            const maxArea = Math.max(...areas);
            const minArea = Math.min(...areas);
            
            if (maxArea - minArea <= 2) {
                break;
            }
            
            const maxIdx = areas.indexOf(maxArea);
            const minIdx = areas.indexOf(minArea);
            const transferred = this.transferCellSafe(grid, regionCells, maxIdx, minIdx, random);
            
            if (!transferred) {
                failureStreak++;
                if (failureStreak > 30) {
                    this.randomMorphBoundaries(grid, regionCells, random, 200, 6);
                    failureStreak = 0;
                }
            } else {
                failureStreak = 0;
            }
        }
        
        const finalAreas = regionCells.map(cells => cells.length);
        const diff = Math.max(...finalAreas) - Math.min(...finalAreas);
        console.log(`面积平衡完成，最终面积: ${finalAreas.join(', ')}，差异: ${diff}`);
    }
    
    // 安全地转移格子，确保源区域和目标区域都保持连通
    transferCellSafe(grid, regionCells, fromIdx, toIdx, random) {
        const fromRegion = fromIdx + 1;
        const toRegion = toIdx + 1;
        
        // 找到from区域中与to区域相邻的格子
        const candidates = [];
        
        for (const [x, y] of regionCells[fromIdx]) {
            // 检查是否与目标区域相邻
            const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
            let adjacentToTarget = false;
            
            for (const [nx, ny] of neighbors) {
                if (nx >= 0 && nx < this.gridWidth && ny >= 0 && ny < this.gridHeight) {
                    if (grid[ny][nx] === toRegion) {
                        adjacentToTarget = true;
                        break;
                    }
                }
            }
            
            if (adjacentToTarget) {
                candidates.push([x, y]);
            }
        }
        
        if (candidates.length === 0) return false;
        
        // 随机打乱候选列表，尝试找到可以安全转移的格子
        candidates.sort(() => random() - 0.5);
        
        for (const [x, y] of candidates) {
            // 使用canFlipCell检查是否可以翻转
            if (this.canFlipCell(grid, [x, y], fromRegion, toRegion)) {
                // 执行转移
                grid[y][x] = toRegion;
                
                // 更新regionCells
                const cellIdx = regionCells[fromIdx].findIndex(([cx, cy]) => cx === x && cy === y);
                if (cellIdx >= 0) {
                    regionCells[fromIdx].splice(cellIdx, 1);
                    regionCells[toIdx].push([x, y]);
                }
                
                return true;
            }
        }
        
        return false;
    }
    
    // 检查是否可以翻转格子（从regionA到regionB），保持regionA连通
    canFlipCell(grid, cell, regionA, regionB) {
        const [x, y] = cell;
        
        // 创建临时网格
        const tempGrid = grid.map(row => [...row]);
        tempGrid[y][x] = regionB;
        
        // 检查源区域是否仍然连通
        return this.isRegionConnected(tempGrid, regionA);
    }
    
    // 验证格子数组是否连通（BFS）
    verifyCellsConnected(cells) {
        if (cells.length === 0) return true;
        
        const visited = new Set();
        const queue = [cells[0]];
        visited.add(`${cells[0][0]},${cells[0][1]}`);
        
        while (queue.length > 0) {
            const [x, y] = queue.shift();
            const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
            
            for (const [nx, ny] of neighbors) {
                const key = `${nx},${ny}`;
                if (!visited.has(key) && cells.some(([cx, cy]) => cx === nx && cy === ny)) {
                    visited.add(key);
                    queue.push([nx, ny]);
                }
            }
        }
        
        return visited.size === cells.length;
    }
    
    // 检查区域是否连通（BFS）
    isRegionConnected(grid, regionId) {
        // 找到该区域的第一个格子
        let startX = -1, startY = -1;
        for (let y = 0; y < this.gridHeight && startX === -1; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (grid[y][x] === regionId) {
                    startX = x;
                    startY = y;
                    break;
                }
            }
        }
        
        if (startX === -1) return true; // 区域为空，认为连通
        
        // BFS检查连通性
        const visited = new Set();
        const queue = [[startX, startY]];
        visited.add(`${startX},${startY}`);
        let count = 1;
        
        while (queue.length > 0) {
            const [x, y] = queue.shift();
            const neighbors = [
                [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
            ];
            
            for (const [nx, ny] of neighbors) {
                const key = `${nx},${ny}`;
                if (nx >= 0 && nx < this.gridWidth && ny >= 0 && ny < this.gridHeight &&
                    !visited.has(key) && grid[ny][nx] === regionId) {
                    visited.add(key);
                    queue.push([nx, ny]);
                    count++;
                }
            }
        }
        
        // 计算该区域的总格子数
        let total = 0;
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (grid[y][x] === regionId) total++;
            }
        }
        
        return count === total;
    }




    // 将网格坐标转换为SVG路径（合并为单一区域，无内部格子线）
    gridToPath(cells) {
        if (cells.length === 0) return '';
        
        const size = this.gridSize;
        
        // 绘制所有单元格，让SVG的fill-rule合并它们
        const rects = cells.map(([x, y]) => 
            `M${x * size},${y * size} L${(x+1) * size},${y * size} L${(x+1) * size},${(y+1) * size} L${x * size},${(y+1) * size} Z`
        );
        
        return rects.join(' ');
    }

    // 种子随机数生成器
    seededRandom(seed) {
        let state = seed;
        return function() {
            state = (state * 9301 + 49297) % 233280;
            return state / 233280;
        };
    }

    // 初始化关卡
    initLevel() {
        this.state = GameState.SELECTING;
        this.selectedRegion = null;
        this.levelDisplay.textContent = this.currentLevel;
        
        // 清空容器
        this.regionsContainer.innerHTML = '';
        this.gridContainer.innerHTML = '';
        this.markersContainer.innerHTML = '';
        this.ranksContainer.innerHTML = '';
        
        // 获取当前关卡配置
        const config = this.getLevelConfig(this.currentLevel);
        this.regions = config.regions;
        
        // 按面积排序（从小到大）
        this.regions.sort((a, b) => a.area - b.area);
        
        // 重新分配ID（排名）
        this.regions.forEach((region, index) => {
            region.rank = index + 1; // 1=最小，4=最大
        });
        
        // 输出调试信息
        console.log(`关卡 ${this.currentLevel} - 区域面积:`, 
            this.regions.map((r, i) => `区域${i+1}(${['灰','红','蓝','橙'][r.id]}): ${r.area}格`).join(', '));
        
        // 打乱显示顺序
        const displayRegions = [...this.regions].sort(() => Math.random() - 0.5);
        
        // 渲染区域
        displayRegions.forEach(region => {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', region.path);
            path.setAttribute('fill', region.color);
            path.setAttribute('class', 'region');
            path.setAttribute('data-id', region.id);
            path.addEventListener('click', () => this.selectRegion(region.id));
            this.regionsContainer.appendChild(path);
        });
        
        this.revealBtn.disabled = true;
    }

    // 选择区域
    selectRegion(regionId) {
        if (this.state !== GameState.SELECTING) return;
        
        this.selectedRegion = regionId;
        
        // 更新视觉效果
        const regions = this.regionsContainer.querySelectorAll('.region');
        regions.forEach(r => {
            if (parseInt(r.getAttribute('data-id')) === regionId) {
                r.classList.add('selected');
            } else {
                r.classList.remove('selected');
            }
        });
        
        // 清除旧标记
        this.markersContainer.innerHTML = '';
        
        // 添加选择标记
        const region = this.regions.find(r => r.id === regionId);
        if (region && region.cells.length > 0) {
            // 计算区域中心
            const centerX = region.cells.reduce((sum, [x]) => sum + x, 0) / region.cells.length;
            const centerY = region.cells.reduce((sum, [, y]) => sum + y, 0) / region.cells.length;
            
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            marker.setAttribute('cx', centerX * this.gridSize + this.gridSize / 2);
            marker.setAttribute('cy', centerY * this.gridSize + this.gridSize / 2);
            marker.setAttribute('r', '15');
            marker.setAttribute('class', 'selection-marker');
            this.markersContainer.appendChild(marker);
        }
        
        this.revealBtn.disabled = false;
    }

    // 揭晓动画
    async reveal() {
        if (this.state !== GameState.SELECTING || this.selectedRegion === null) {
            return;
        }
        
        this.state = GameState.REVEALING;
        this.revealBtn.disabled = true;
        
        // 禁用区域点击
        const regions = this.regionsContainer.querySelectorAll('.region');
        regions.forEach(r => {
            r.classList.add('disabled');
            r.style.pointerEvents = 'none';
        });
        
        // 清除选择标记
        this.markersContainer.innerHTML = '';
        
        // 显示网格线
        await this.showGrid();
        
        // 开始减少动画
        await this.animateReveal();
        
        // 等待2秒后进入下一关
        setTimeout(() => {
            this.nextLevel();
        }, 2000);
    }

    // 显示网格线
    async showGrid() {
        // 绘制垂直线
        for (let x = 0; x <= this.gridWidth; x++) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x * this.gridSize);
            line.setAttribute('y1', 0);
            line.setAttribute('x2', x * this.gridSize);
            line.setAttribute('y2', this.gridHeight * this.gridSize);
            line.setAttribute('class', 'grid-line');
            this.gridContainer.appendChild(line);
        }
        
        // 绘制水平线
        for (let y = 0; y <= this.gridHeight; y++) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', 0);
            line.setAttribute('y1', y * this.gridSize);
            line.setAttribute('x2', this.gridWidth * this.gridSize);
            line.setAttribute('y2', y * this.gridSize);
            line.setAttribute('class', 'grid-line');
            this.gridContainer.appendChild(line);
        }
        
        // 延迟显示网格
        await this.sleep(100);
        const gridLines = this.gridContainer.querySelectorAll('.grid-line');
        gridLines.forEach(line => line.classList.add('visible'));
        
        await this.sleep(300);
    }

    // 揭晓动画 - 相同速度一格一格减少
    async animateReveal() {
        // 为每个区域创建副本用于动画
        const regionStates = this.regions.map(region => ({
            ...region,
            remainingCells: [...region.cells]
        }));
        
        const animationSpeed = 150; // 每格消失的间隔时间（毫秒）
        
        // 同时减少所有区域，每次每个区域减少一格
        while (regionStates.some(r => r.remainingCells.length > 0)) {
            for (const regionState of regionStates) {
                if (regionState.remainingCells.length > 0) {
                    // 随机移除一个格子
                    const randomIndex = Math.floor(Math.random() * regionState.remainingCells.length);
                    regionState.remainingCells.splice(randomIndex, 1);
                    
                    // 更新SVG路径
                    const path = this.gridToPath(regionState.remainingCells);
                    const pathElement = this.regionsContainer.querySelector(`[data-id="${regionState.id}"]`);
                    if (pathElement) {
                        pathElement.setAttribute('d', path);
                    }
                    
                    // 如果区域刚好完全消失，显示排名
                    if (regionState.remainingCells.length === 0 && !regionState.ranked) {
                        regionState.ranked = true;
                        await this.sleep(100); // 短暂延迟
                        this.showRank(regionState);
                        await this.sleep(600); // 显示排名后暂停，让玩家看清楚
                    }
                }
            }
            
            // 统一的动画速度
            await this.sleep(animationSpeed);
        }
    }

    // 显示排名
    showRank(region) {
        // 计算原始区域中心
        const centerX = region.cells.reduce((sum, [x]) => sum + x, 0) / region.cells.length;
        const centerY = region.cells.reduce((sum, [, y]) => sum + y, 0) / region.cells.length;
        
        const rankText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        rankText.setAttribute('x', centerX * this.gridSize + this.gridSize / 2);
        rankText.setAttribute('y', centerY * this.gridSize + this.gridSize / 2);
        rankText.setAttribute('class', 'rank-text show');
        
        // 根据排名显示文字
        const rankLabels = ['第4名', '第3名', '第2名', '第1名'];
        rankText.textContent = rankLabels[region.rank - 1];
        
        // 如果是用户选择的区域，添加高亮
        if (region.id === this.selectedRegion) {
            rankText.classList.add('highlight');
        }
        
        this.ranksContainer.appendChild(rankText);
    }

    // 下一关
    nextLevel() {
        this.currentLevel++;
        if (this.currentLevel > this.maxLevel) {
            // 游戏结束
            alert('恭喜！您已完成所有30关！');
            this.currentLevel = 1;
        }
        this.initLevel();
    }

    // 工具函数：延迟
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 附加事件监听器
    attachEventListeners() {
        if (this.revealBtn) {
            // 移除可能存在的旧事件监听器
            this.revealBtn.removeEventListener('click', this.handleRevealClick);
            
            // 绑定新的事件监听器
            this.handleRevealClick = (event) => {
                if (this.state === GameState.SELECTING && this.selectedRegion !== null && !this.revealBtn.disabled) {
                    this.reveal();
                }
            };
            
            this.revealBtn.addEventListener('click', this.handleRevealClick);
        }
    }
}

// 初始化游戏
window.addEventListener('DOMContentLoaded', () => {
    new AreaGame();
});
