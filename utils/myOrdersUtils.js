import safeTraverse from 'lodash/get';
import formatDate from 'date-fns/format';
import { getParentItem, getGroceryBasketFields, segregateOrdersIntoGroups } from 'utils/orderUtils';
import { GROUP_TYPES } from 'constants/OrderConstants';

export const retOne = () => {
	return 2;
}

export const getOrders = data => {
	if (!data) return null;

	const ordersList = safeTraverse(data, ['orderGranularDetails']);
	return ordersList ? ordersList.map(order => getOrder(order)) : null;
};

const getOrder = order => {
	if (!order) return null;
	const orderDetailsLinkPreStr = `/order_details?order_id=`;

	return {
		items: getItemGroups(order),
		orderId: safeTraverse(order, ['orderId']),
		orderDate: getFormattedDate(safeTraverse(order, ['orderDate'])),
		promiseDate: getFormattedDate(safeTraverse(order, ['orderLvlPromiseDate'])),
		totalAmount: safeTraverse(order, ['amount']),
		numberOfItems: safeTraverse(order, ['numberOfItems']),
		orderDetailLink: orderDetailsLinkPreStr + safeTraverse(order, ['orderId']),
		orderType: safeTraverse(order, ['orderType']),
		orderSubType: safeTraverse(order, ['orderSubType']),
		customerInfo: safeTraverse(order, ['customerInfo']),
		orderCancellationAllowed: safeTraverse(order, ['orderCancellationAllowed']),
		orderNotifications: safeTraverse(order, ['orderNotifications', 0])
	};
};

/**
 * Returns a list of all 'items' in the current Order.
 * Takes into account the parent-child relationship between items.
 *
 * @param order		The Order object
 * @returns Array	Array of orderItems in the current Order.
 * 					Child orderItems are added in the childItems array, within the parent items
 */
export const getItemGroups = order => {
	const groupedItems = safeTraverse(order, ['groupedItems']);
	const itemTypeGroups = safeTraverse(order, ['itemTypeGroups']) || {};

	const basketDetails = getGroceryBasketDetails(itemTypeGroups);

	let items = getItems(groupedItems);

	items = segregateOrdersIntoGroups(order, items, basketDetails);
	return items;
};

const getItems = groupedItems => {
	const mainItems = groupedItems.map(itemList => getItem(itemList));
	let childItemIds = [];

	mainItems.forEach(item => {
		const childItem = safeTraverse(item, ['data', 'childItemId']);
		if (childItem) {
			childItemIds = childItemIds.concat(childItem);
		}
	});
	let parentItems = mainItems.filter(item => {
		return childItemIds.indexOf(item.data.itemId) === -1;
	});
	parentItems = parentItems.map(item => {
		const childItemId = safeTraverse(item, ['data', 'childItemId']);
		const childItem = mainItems.reduce((childItem, item) => {
			if (childItemId && childItemId.indexOf(item.data.itemId) !== -1) {
				childItem.push(item);
			}
			return childItem;
		}, []);
		item.childItems = [];
		if (childItem && childItem.length) item.childItems = item.childItems.concat(childItem);
		return item;
	});
	return parentItems;
};

const getItem = (item, info) => {
	if (!item) return null;
	return {
		data: getItemInfo(getParentItem(item), info),
		returnDetails: getReturnDetails(item, info),
		refundDetails: getRefundDetails(item)
	};
};

const getItemInfo = (mainItem, info) => {
	if (!mainItem) return null;
	const _item = {
		groupType: safeTraverse(mainItem, ['groupType']),
		fsn: safeTraverse(mainItem, ['fsn']),
		title: safeTraverse(mainItem, ['title']),
		amount: safeTraverse(mainItem, ['amount']),
		quantity: safeTraverse(mainItem, ['quantity']),
		type: safeTraverse(mainItem, ['itemType']),
		subType: safeTraverse(mainItem, ['itemSubType']),
		omniStatus: safeTraverse(mainItem, ['status']) || '',
		status: safeTraverse(mainItem, ['desktopStatus']) || '',
		subStatus: safeTraverse(mainItem, ['desktopSubStatus']) || '',
		returnBadge: safeTraverse(mainItem, ['returnBadge']),
		metadata: safeTraverse(mainItem, ['itemMetadata']),
		childItemId: safeTraverse(mainItem, ['associatedOrderItemIds']),
		abbData: safeTraverse(mainItem, ['assuredBuyBackData']),
		lastProgressText: getLastEventDateText(mainItem),
		itemId: safeTraverse(mainItem, ['orderItemId']),
		unitId: safeTraverse(mainItem, ['orderItemUnitIdString']),
		shipmentTracking: getShipmentTrackingInfo(mainItem),
		promiseFromDate: getFormattedDate(safeTraverse(mainItem, ['promiseFromDate'])),
		promisedDate: getFormattedDate(safeTraverse(mainItem, ['promisedDate'])),
		deliveryDate: getFormattedDate(safeTraverse(mainItem, ['actualDeliveredDate'])),
		offersCount: (safeTraverse(mainItem, ['itemOffers']) && mainItem.itemOffers.length) || 0,
		flags: {
			itemCancellable: safeTraverse(mainItem, ['itemCancellable']),
			itemReturnable: safeTraverse(mainItem, ['itemReturnable']),
			itemReviewable: safeTraverse(mainItem, ['itemReviewable']),
			itemSchedulable: safeTraverse(mainItem, ['itemSchedulable']),
			isPreOrder: safeTraverse(mainItem, ['preOrder'])
		},
		seller: safeTraverse(mainItem, ['sellerName']),
		sellerUrl: safeTraverse(mainItem, ['sellerUrl']),
		serviceItemInfo: safeTraverse(mainItem, ['serviceItemInfo']),
		vasItemDetails: safeTraverse(mainItem, ['vasItemDetails'])
	};
	if (_item.vasItemDetails && safeTraverse(_item, ['metadata', 'url'])) _item.metadata.url = '';
	return _item;
};

const getReturnRefunds = ({ returnTracking }) => {
	return returnTracking
		? returnTracking.reduce((details, ret) => {
			return ret.refundDetails ? (details || []).concat(ret.refundDetails) : details;
		}, null)
		: null;
};

const getRefundDetails = itemList => {
	if (!itemList || itemList.length === 0) return null;
	const items = [];
	itemList.map(item => {
		const refundInfo =
			getStatusList(item.nonReturnRefunds, 'refundStatus') || getReturnRefunds(item);
		if (refundInfo) {
			items.push({
				refundsList: refundInfo
			});
		}
	});
	return items.length > 0 ? items : null;
};

const getReturnDetails = (itemList, info) => {
	if (!itemList || itemList.length === 0) return null;
	const items = [];
	itemList.map(item => {
		const returnInfo = getStatusList(
			item.returnTracking,
			'returnStatus',
			item,
			itemList,
			info,
			item.returnBadge
		);
		if (returnInfo) {
			items.push({
				returnsList: returnInfo
			});
		}
	});
	return items.length > 0 ? items : null;
};

const getStatusList = (
	list,
	type,
	parentItem = null,
	itemsList = null,
	info = null,
	badge = null
) => {
	if (!list || list.length === 0) return null;

	const refinedList = list.filter(function (item) {
		return safeTraverse(item, [type]) !== 'Splitted';
	});

	if (type === 'refundStatus') {
		return refinedList;
	} else if (type === 'returnStatus') {
		if (!refinedList) return null;
		const returnItems = [];
		refinedList.map((listItem, i) => {
			const replacementOrExchangeItemId = listItem.replacementOrExchangeItemId;
			if (replacementOrExchangeItemId) {
				const returnSpecificData = badge
					? getItemInfo(parentItem, info)
					: getReturnSpecificData(itemsList, replacementOrExchangeItemId, info);
				returnItems.push({
					data: returnSpecificData,
					returnInfo: listItem
				});
			}
		});
		return returnItems.length > 0 ? returnItems : null;
	}
	return null;
};

const getReturnSpecificData = (itemList, itemId, info) => {
	if (!itemList) return null;

	const item = itemList.filter(function (item) {
		return item.orderItemId === itemId;
	});
	return item ? getItemInfo(item[0], info) : null;
};

const getFormattedDate = dateObj => {
	if (!dateObj) return null;
	return formatDate(dateObj, "ddd, MMM Do 'YY");
};

const getLastEventDateText = item => {
	if (!item) return null;
	const connector = ' on ';
	const steps = safeTraverse(item, ['itemProgressSteps']);
	const lastStep = steps ? steps[steps.length - 1].children : null;
	const lastEventDate = lastStep ? lastStep[lastStep.length - 1].eventDate : null;
	return lastEventDate ? connector + formatDate(lastEventDate, "ddd, MMM Do 'YY") : null;
};

const getShipmentTrackingInfo = item => {
	if (!item || safeTraverse(item, ['status']) !== 'Shipped') return null;
	const progressSteps = safeTraverse(item, ['itemProgressSteps']);
	const shippedStep =
		progressSteps &&
		progressSteps.filter(function (step) {
			return (
				step.groupName.toLowerCase() === 'shipping' &&
				step.status.toLowerCase() === 'current'
			);
		});
	const shippedChild =
		safeTraverse(shippedStep, [0, 'children']) &&
		shippedStep[0].children.filter(function (child) {
			return (
				child.eventLink &&
				child.eventLinkText &&
				child.eventName.toLowerCase() === 'itemshippedstep'
			);
		});
	if (shippedChild) {
		return {
			shipmentLink: safeTraverse(shippedChild, [0, 'eventLink']),
			shipmentText: safeTraverse(shippedChild, [0, 'eventLinkText'])
		};
	}
	return null;
};

const getGroceryBasketDetails = itemTypeGroups => {
	const groceryGroup = safeTraverse(itemTypeGroups, [GROUP_TYPES.GROCERY]);

	return Object.assign({}, getGroceryBasketFields(groceryGroup), {
		basketStatus: safeTraverse(groceryGroup, ['status'])
	});
};
