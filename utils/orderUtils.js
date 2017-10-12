import _get from 'lodash/get';
import format from 'date-fns/format';
import {pick} from 'lodash';
import { GROUP_TYPES } from 'constants/OrderConstants';
import { getParentItem, getGroceryBasketFields, segregateOrdersIntoGroups } from 'utils/orderUtils';
const {FLIPKART, GROCERY} = GROUP_TYPES;

export const MAX_AUTO_LOAD_PAGES = 4;

export const orderDeadStates = [
	'cancelled',
	'cancel_requested',
	'cancellation requested'
];

export const orderTypes = {
	SUBSCRIPTION: 'subscription',
	PHYSICAL: 'physical',
	DIGITAL: 'digital',
	EGV: 'egv',
	DIGITAL_SERVICE: 'digital_service'
};

export const loadingStatus = {
	SHOW_MORE: 'SHOW_MORE',
	NO_MORE: 'NO_MORE',
	LOADING: 'LOADING'
};

export const orderState = {
	RETURN: 'RETURN',
	RETURN_REQUEST: 'RETURN_REQUEST',
	CANCEL: 'CANCEL',
	DONE: 'DONE',
	INACTIVE: 'INACTIVE',
	CURRENT: 'CURRENT',
	NA: 'NA'
};

export const actionTypes = {
	PRINT: 'print',
	CONTACTUS: 'contactus',
	REVIEW: 'review',
	CANCEL: 'cancel',
	RETURN: 'return',
	GIFTCARD: 'giftcard',
	ADDEGVTOWALLET: 'addegvtowallet',
	PAYNOW: 'payNow',
	INVOICE: 'invoice',
	SELLERREVIEW: 'sellerReview',
	SUBSCRIPTION: 'subscription'
};

export const getParentItem = itemList => {
	if (!itemList) return null;
	const parent = itemList.filter(function (item) {
		return (item.returnBadge === null);
	});
	return parent.length > 0 ? parent[0] : null;
};


export const segregateOrdersIntoGroups = (orderGranularDetails, groupedItems, groceryBasketDetails) => {
	const flipkartItemTypeList = getItemTypeList(orderGranularDetails, FLIPKART);
	const groceryItemTypeList = getItemTypeList(orderGranularDetails, GROCERY);
 
	let finalItems = [];	// final array containing all order items
	let groceryItems = [];	// used for further processing of grocery items

	groupedItems.forEach(groupedItem => {
		//	data structure is different for myOrders and orderDetailsdata.
		//	should take it up in future.
		const orderData = _get(groupedItem, ['data'], groupedItem);

		switch (orderData.groupType) {
			case FLIPKART: if (findItem(flipkartItemTypeList, orderData.unitId)) {
				finalItems.push(groupedItem);
			}
				break;
			case GROCERY: if (findItem(groceryItemTypeList, orderData.unitId)) {
				groceryItems.push(groupedItem);
			}
				break;
			default: break;
		}
	});

	//	compute this for grocery basket.
	const cancellableItems = groceryItems.length > 0 && getCancellableItems(groceryItems);

	//	push items into basket and basket as main order item to list.
	groceryItems.length > 0 && finalItems.push(Object.assign({}, groceryBasketDetails, {
		orderItems: groceryItems,
		unitIdsString: cancellableItems.map(item => {
			const orderData = _get(item, ['data'], item);
			return orderData.unitId;
		}).join(',')
	}));

	return finalItems;
};


export const getGroceryBasketFields = groceryData => {
	return {
		groupType: GROCERY,
		returnPolicy: _get(groceryData, ['returnPolicy']),
		basketAmount: _get(groceryData, ['groupAmount']),
		basketSellerName: _get(groceryData, ['groupSellerName']),
		basketSellerLink: _get(groceryData, ['groupSellerLink']),
		basketOffersCount: _get(groceryData, ['groupOffersCount']),
		basketLevelOffers: _get(groceryData, ['groupLevelOffers']),
		basketStatusCount: _get(groceryData, ['statusCounts']),
		basketDeliveryStatus: _get(groceryData, ['desktopStatus']),
		basketSubStatus: _get(groceryData, ['desktopSubStatus']),
		basketCancellable: _get(groceryData, ['basketCancellable'])
	};
};


const getItemTypeList = (ordersData, groupType) => {
	return ordersData && _get(ordersData, ['itemTypeGroups', groupType, 'itemTypeList']);
};
